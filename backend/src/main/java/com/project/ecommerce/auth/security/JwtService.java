package com.project.ecommerce.auth.security;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.TokenType;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private static final String CLAIM_ROLE = "role";
    private static final String CLAIM_TOKEN_TYPE = "token_type";
    private static final String CLAIM_USER_ID = "user_id";

    private final SecretKey secretKey;
    private final JwtProperties properties;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.secretKey = buildSecretKey(properties.secret());
    }

    public String generateAccessToken(AuthenticatedUser user) {
        return buildToken(user.getUserId(), user.getUsername(), user.getActiveRole(), TokenType.ACCESS, properties.accessTokenExpirationSeconds());
    }

    public String generateRefreshToken(AuthenticatedUser user) {
        return buildToken(user.getUserId(), user.getUsername(), user.getActiveRole(), TokenType.REFRESH, properties.refreshTokenExpirationSeconds());
    }

    public String generatePasswordResetToken(UUID userId, String email, RoleType roleType) {
        return buildToken(userId, email, roleType, TokenType.PASSWORD_RESET, properties.passwordResetExpirationSeconds());
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(extractClaims(token).get(CLAIM_USER_ID, String.class));
    }

    public RoleType extractRole(String token) {
        return RoleType.valueOf(extractClaims(token).get(CLAIM_ROLE, String.class));
    }

    public TokenType extractTokenType(String token) {
        return TokenType.valueOf(extractClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public boolean isTokenValid(String token, AuthenticatedUser user, TokenType expectedType) {
        Claims claims = extractClaims(token);
        return extractTokenType(token) == expectedType
            && claims.getSubject().equalsIgnoreCase(user.getUsername())
            && !claims.getExpiration().before(new Date());
    }

    private String buildToken(UUID userId, String email, RoleType roleType, TokenType tokenType, long expirationSeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(email)
            .claims(Map.of(
                CLAIM_USER_ID, userId.toString(),
                CLAIM_ROLE, roleType.name(),
                CLAIM_TOKEN_TYPE, tokenType.name()
            ))
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirationSeconds)))
            .signWith(secretKey)
            .compact();
    }

    private Claims extractClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    private SecretKey buildSecretKey(String secret) {
        try {
            return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        } catch (IllegalArgumentException ex) {
            return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        }
    }
}
