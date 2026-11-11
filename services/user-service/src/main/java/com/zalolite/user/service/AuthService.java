package com.zalolite.user.service;

import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;

public interface AuthService {
    Responses.Auth register(Requests.Register request);
    Responses.Auth login(Requests.Login request);
    Responses.Auth refresh(String refreshToken);
    void logout(String refreshToken);
    void changePassword(String userId, Requests.ChangePassword request);
}
