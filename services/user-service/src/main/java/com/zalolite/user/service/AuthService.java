package com.zalolite.user.service;

import com.zalolite.user.dto.request.LoginRequest;
import com.zalolite.user.dto.request.RegisterRequest;
import com.zalolite.user.dto.response.AuthResponse;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    AuthResponse refresh(String refreshToken);
    void logout(String refreshToken);
}
