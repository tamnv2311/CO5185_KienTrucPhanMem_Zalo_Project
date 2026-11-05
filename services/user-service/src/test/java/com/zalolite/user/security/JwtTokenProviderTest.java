package com.zalolite.user.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {
    private final JwtTokenProvider provider =
            new JwtTokenProvider("zalolite-test-secret-with-at-least-32-bytes");

    @Test
    void shouldCreateAccessTokenWithUserSubject() {
        String token = provider.createAccessToken("user-1");

        assertThat(provider.userId(token)).isEqualTo("user-1");
    }

    @Test
    void shouldCreateRefreshTokenWithUniqueTokenId() {
        String first = provider.createRefreshToken("user-1");
        String second = provider.createRefreshToken("user-1");

        assertThat(provider.tokenId(first)).isNotBlank();
        assertThat(provider.tokenId(second)).isNotEqualTo(provider.tokenId(first));
    }
}
