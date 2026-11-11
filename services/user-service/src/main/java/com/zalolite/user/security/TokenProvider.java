package com.zalolite.user.security;

import java.time.Duration;

public interface TokenProvider {
    String createAccessToken(String userId);
    String createRefreshToken(String userId);
    /** Subject of a valid token; throws when the token is invalid or expired. */
    String userId(String token);
    String tokenId(String token);
    boolean isRefreshToken(String token);
    Duration accessTtl();
    Duration refreshTtl();
}
