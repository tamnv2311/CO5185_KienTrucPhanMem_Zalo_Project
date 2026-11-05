package com.zalolite.user.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.user.dto.request.UpdateProfileRequest;
import com.zalolite.user.dto.response.UserProfileResponse;
import com.zalolite.user.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ApiResponse<UserProfileResponse> me(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(userService.currentUser(userId));
    }

    @PutMapping("/me")
    public ApiResponse<UserProfileResponse> update(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody UpdateProfileRequest request) {
        return ApiResponse.ok(userService.update(userId, request));
    }
}
