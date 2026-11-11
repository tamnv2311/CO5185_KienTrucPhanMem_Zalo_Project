package com.zalolite.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/** Single place that signs and verifies ZaloLite JWTs (gateway, user-service and chat-service share it). */
public class JwtService {
    public static final String TYPE_CLAIM = "typ";
    public static final String ACCESS = "access";
    public static final String REFRESH = "refresh";

    private final SecretKey key;

    public JwtService(String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(String userId, Duration ttl) {
        return createToken(userId, ttl, ACCESS);
    }

    public String createRefreshToken(String userId, Duration ttl) {
        return createToken(userId, ttl, REFRESH);
    }

    private String createToken(String userId, Duration ttl, String type) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .id(UUID.randomUUID().toString())
                .claim(TYPE_CLAIM, type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Verifies signature and expiry. Throws JwtException when the token is not valid. */
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    /** User id of a valid access token. Refresh tokens are rejected so they cannot be used to call APIs. */
    public String accessUserId(String token) {
        Claims claims = parse(token);
        if (!ACCESS.equals(claims.get(TYPE_CLAIM, String.class))) {
            throw new JwtException("Not an access token");
        }
        return claims.getSubject();
    }
}
