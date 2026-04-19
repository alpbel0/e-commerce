package com.project.ecommerce.chatbot.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Response DTO for the internal schema endpoint.
 * Provides AI service with analytics schema context.
 */
public record SchemaResponse(
    String schemaVersion,
    LocalDateTime updatedAt,
    List<TableSchema> tables,
    List<Relationship> relationships,
    RoleRules roleRules
) {

    public static SchemaResponse create(
        String schemaVersion,
        List<TableSchema> tables,
        List<Relationship> relationships,
        RoleRules roleRules
    ) {
        return new SchemaResponse(
            schemaVersion,
            LocalDateTime.now(),
            tables,
            relationships,
            roleRules
        );
    }

    public record TableSchema(
        String tableName,
        String description,
        List<ColumnSchema> columns,
        boolean isAccessible
    ) {}

    public record ColumnSchema(
        String name,
        String dataType,
        String description,
        boolean isSensitive,
        boolean isPII
    ) {}

    public record Relationship(
        String fromTable,
        String fromColumn,
        String toTable,
        String toColumn,
        String relationshipType
    ) {}

    public record RoleRules(
        List<String> adminAccessibleTables,
        List<String> corporateAccessibleTables,
        List<String> individualAccessibleTables,
        List<String> sensitiveColumns,
        List<String> piiColumns
    ) {}
}
