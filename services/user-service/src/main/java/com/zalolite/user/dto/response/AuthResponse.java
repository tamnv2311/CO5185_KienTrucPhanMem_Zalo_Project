package com.zalolite.user.dto.response;

public record AuthResponse(String accessToken, String refreshToken, UserProfileResponse user) {
}
