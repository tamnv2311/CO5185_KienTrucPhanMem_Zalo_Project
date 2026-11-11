package com.zalolite.user.security;

import com.zalolite.common.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class JwtTokenProvider implements TokenProvider {
    private final JwtService jwt;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    @Autowired
    public JwtTokenProvider(@Value("${jwt.secret}") String secret,
                            @Value("${jwt.access-ttl-minutes:60}") long accessMinutes,
                            @Value("${jwt.refresh-ttl-days:7}") long refreshDays) {
        this.jwt = new JwtService(secret);
        this.accessTtl = Duration.ofMinutes(accessMinutes);
        this.refreshTtl = Duration.ofDays(refreshDays);
    }

    public JwtTokenProvider(String secret) {
        this(secret, 60, 7);
    }

    @Override
    public String createAccessToken(String userId) {
        return jwt.createAccessToken(userId, accessTtl);
    }

    @Override
    public String createRefreshToken(String userId) {
        return jwt.createRefreshToken(userId, refreshTtl);
    }

    @Override
    public String userId(String token) {
        return jwt.parse(token).getSubject();
    }

    @Override
    public String tokenId(String token) {
        return jwt.parse(token).getId();
    }

    @Override
    public boolean isRefreshToken(String token) {
        return JwtService.REFRESH.equals(jwt.parse(token).get(JwtService.TYPE_CLAIM, String.class));
    }

    @Override
    public Duration accessTtl() {
        return accessTtl;
    }

    @Override
    public Duration refreshTtl() {
        return refreshTtl;
    }
}
