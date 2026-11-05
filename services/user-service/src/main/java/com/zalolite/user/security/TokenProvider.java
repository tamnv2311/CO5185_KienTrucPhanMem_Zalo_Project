package com.zalolite.user.security;

public interface TokenProvider {
    String createAccessToken(String userId);
    String createRefreshToken(String userId);
    String userId(String token);
    String tokenId(String token);
}
