package com.project.ecommerce.chatbot.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.chatbot.config.ChatbotProperties;
import com.project.ecommerce.chatbot.dto.QueryExecutorRequest;
import com.project.ecommerce.chatbot.dto.QueryExecutorResponse;
import com.project.ecommerce.store.repository.StoreRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QueryExecutorService {

    private static final Logger log = LoggerFactory.getLogger(QueryExecutorService.class);

    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 500;
    private static final Pattern TABLE_REFERENCE_PATTERN = Pattern.compile(
        "\\b(?:from|join)\\s+([a-zA-Z_][a-zA-Z0-9_\\.\\\"]*)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile(":([a-zA-Z_][a-zA-Z0-9_]*)");

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final StoreRepository storeRepository;
    private final QueryAuditLogService queryAuditLogService;
    private final SqlSafetyValidator sqlSafetyValidator;

    public QueryExecutorService(
        NamedParameterJdbcTemplate jdbcTemplate,
        StoreRepository storeRepository,
        QueryAuditLogService queryAuditLogService,
        SqlSafetyValidator sqlSafetyValidator,
        ChatbotProperties chatbotProperties
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.storeRepository = storeRepository;
        this.queryAuditLogService = queryAuditLogService;
        this.sqlSafetyValidator = sqlSafetyValidator;
        this.jdbcTemplate.getJdbcTemplate().setQueryTimeout(chatbotProperties.getQueryTimeoutSeconds());
    }

    @Transactional
    public QueryExecutorResponse executeQuery(QueryExecutorRequest request) {
        long startTime = System.currentTimeMillis();

        try {
            sqlSafetyValidator.validate(request.sql(), request.userContext().role(), request.executionPolicy());
        } catch (SqlSafetyValidator.SqlValidationException e) {
            log.warn("Query rejected by validator: requestId={}, reason={}", request.requestId(), e.getMessage());
            auditLog(request, "REJECTED", e.getMessage(), 0, 0);
            return QueryExecutorResponse.error(request.requestId(), e.getMessage());
        }

        // Step 1: Verify allowed stores from DB (Zero Trust - don't trust AI)
        List<UUID> verifiedStoreIds = verifyAllowedStores(
            request.userContext().userId(),
            request.userContext().role()
        );

        if (verifiedStoreIds.isEmpty() && request.userContext().role() == RoleType.CORPORATE) {
            String error = "User has no verified store access";
            log.warn("Query rejected: {} - requestId={}", error, request.requestId());
            auditLog(request, "REJECTED", error, 0, 0);
            return QueryExecutorResponse.error(request.requestId(), "SQL_SCOPE_VIOLATION: No verified store access");
        }

        // Step 2: Validate selectedStoreId if provided
        if (request.parameters().selectedStoreId() != null &&
            !verifiedStoreIds.contains(request.parameters().selectedStoreId())) {
            String error = "Selected store not in verified allowed stores";
            log.warn("Query rejected: {} - requestId={}", error, request.requestId());
            auditLog(request, "REJECTED", error, 0, 0);
            return QueryExecutorResponse.error(request.requestId(), "SQL_SCOPE_VIOLATION: Selected store not allowed");
        }

        // Step 3: Execute query with verified parameters
        try {
            String executableSql = sqlSafetyValidator.enforceLimit(request.sql(), MAX_LIMIT);
            MapSqlParameterSource sqlParameters = buildSqlParameters(request, verifiedStoreIds);
            log.info("Executing query: requestId={}, sqlHash={}", request.requestId(), hashSql(request.sql()));

            QueryResult queryResult = jdbcTemplate.query(executableSql, sqlParameters, resultSetExtractor());
            long executionMs = System.currentTimeMillis() - startTime;
            List<Object[]> allRows = queryResult.rows();
            int originalRowCount = allRows.size();

            // Truncate if exceeds MAX_LIMIT
            List<Object[]> rowsToReturn = allRows.size() > MAX_LIMIT
                ? allRows.subList(0, MAX_LIMIT)
                : allRows;

            Object[][] rows = rowsToReturn.toArray(new Object[0][]);

            auditLog(request, "EXECUTED", null, rows.length, executionMs);

            return QueryExecutorResponse.success(
                request.requestId(),
                queryResult.columns().toArray(new String[0]),
                rows,
                originalRowCount,
                executionMs
            );

        } catch (Exception e) {
            long executionMs = System.currentTimeMillis() - startTime;
            String errorMessage = e.getMessage();
            log.error("Query execution failed: requestId={}, error={}", request.requestId(), errorMessage);
            auditLog(request, "FAILED", errorMessage, 0, executionMs);
            return QueryExecutorResponse.error(request.requestId(), "SQL_EXECUTION_FAILED: " + sanitizeError(errorMessage));
        }
    }

    private List<UUID> verifyAllowedStores(UUID userId, RoleType role) {
        if (role == RoleType.ADMIN) {
            // Admin has access to all stores - but we still verify via DB
            return storeRepository.findAll().stream()
                .map(store -> store.getId())
                .toList();
        }

        if (role == RoleType.CORPORATE) {
            // Re-verify from DB - don't trust AI's allowedStoreIds
            return storeRepository.findByOwnerId(userId).stream()
                .map(store -> store.getId())
                .toList();
        }

        // Individual users don't have store access in this context
        return List.of();
    }

    private MapSqlParameterSource buildSqlParameters(QueryExecutorRequest request, List<UUID> verifiedStoreIds) {
        int requestedLimit = request.parameters().limit() > 0 ? request.parameters().limit() : DEFAULT_LIMIT;
        int safeLimit = Math.min(requestedLimit, MAX_LIMIT);

        MapSqlParameterSource source = new MapSqlParameterSource();
        source.addValue("currentUserId", request.userContext().userId());
        source.addValue("allowedStoreIds", verifiedStoreIds.isEmpty() ? List.of(new UUID(0L, 0L)) : verifiedStoreIds);
        source.addValue("selectedStoreId", request.parameters().selectedStoreId());
        source.addValue("startDate", request.parameters().startDate());
        source.addValue("endDate", request.parameters().endDate());
        source.addValue("limit", safeLimit);
        return source;
    }

    private ResultSetExtractor<QueryResult> resultSetExtractor() {
        return resultSet -> {
            ResultSetMetaData metadata = resultSet.getMetaData();
            int columnCount = metadata.getColumnCount();
            List<String> columns = new ArrayList<>(columnCount);
            for (int columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
                columns.add(resolveColumnName(metadata, columnIndex));
            }

            List<Object[]> rows = new ArrayList<>();
            while (resultSet.next()) {
                Object[] row = new Object[columnCount];
                for (int columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
                    row[columnIndex - 1] = resultSet.getObject(columnIndex);
                }
                rows.add(row);
            }
            return new QueryResult(columns, rows);
        };
    }

    private String resolveColumnName(ResultSetMetaData metadata, int columnIndex) throws SQLException {
        String label = metadata.getColumnLabel(columnIndex);
        if (label != null && !label.isBlank()) {
            return label;
        }
        return metadata.getColumnName(columnIndex);
    }

    private String hashSql(String sql) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(sql.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            return "unknown";
        }
    }

    private String sanitizeError(String message) {
        // Remove potentially sensitive information
        if (message == null) return "Unknown error";
        // Truncate long messages
        if (message.length() > 200) {
            message = message.substring(0, 200) + "...";
        }
        return message;
    }

    private void auditLog(QueryExecutorRequest request, String status, String rejectionReason, int rowCount, long executionMs) {
        try {
            queryAuditLogService.log(
                request.requestId(),
                request.userContext().userId(),
                request.userContext().role(),
                hashSql(request.sql()),
                summarizeSql(request.sql()),
                status,
                rejectionReason,
                rowCount,
                executionMs
            );
        } catch (Exception e) {
            log.warn("Audit log write failed: requestId={}, status={}, error={}",
                request.requestId(), status, sanitizeError(e.getMessage()));
        }
    }

    private String summarizeSql(String sql) {
        if (sql == null || sql.isBlank()) {
            return "empty-sql";
        }

        String summary = "tables=" + String.join(",", extractMatches(TABLE_REFERENCE_PATTERN, sql))
            + "; placeholders=" + String.join(",", extractMatches(PLACEHOLDER_PATTERN, sql))
            + "; length=" + sql.length();
        if (summary.length() > 500) {
            return summary.substring(0, 497) + "...";
        }
        return summary;
    }

    private List<String> extractMatches(Pattern pattern, String sql) {
        List<String> values = new ArrayList<>();
        Matcher matcher = pattern.matcher(sql);
        while (matcher.find()) {
            String value = matcher.group(1).replace("\"", "");
            if (!values.contains(value)) {
                values.add(value);
            }
        }
        return values;
    }

    private record QueryResult(List<String> columns, List<Object[]> rows) {
    }
}
