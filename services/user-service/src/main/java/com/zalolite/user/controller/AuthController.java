package com.zalolite.user.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<Responses.Auth> register(@Valid @RequestBody Requests.Register request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<Responses.Auth> login(@Valid @RequestBody Requests.Login request) {
        return ApiResponse.ok(authService.login(request));
    }

    /** The refresh token is accepted in the X-Refresh-Token header or in the JSON body. */
    @PostMapping("/refresh")
    public ApiResponse<Responses.Auth> refresh(
            @RequestHeader(name = "X-Refresh-Token", required = false) String header,
            @RequestBody(required = false) Requests.Token body) {
        return ApiResponse.ok(authService.refresh(pick(header, body)));
    }

    @PostMapping("/logout")
    public ApiResponse<Map<String, Boolean>> logout(
            @RequestHeader(name = "X-Refresh-Token", required = false) String header,
            @RequestBody(required = false) Requests.Token body) {
        authService.logout(pick(header, body));
        return ApiResponse.ok(Map.of("loggedOut", true));
    }

    private static String pick(String header, Requests.Token body) {
        if (header != null && !header.isBlank()) {
            return header;
        }
        return body == null ? null : body.refreshToken();
    }
}
