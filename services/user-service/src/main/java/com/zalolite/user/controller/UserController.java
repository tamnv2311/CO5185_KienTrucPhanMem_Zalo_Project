package com.zalolite.user.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.service.AuthService;
import com.zalolite.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final AuthService authService;

    public UserController(UserService userService, AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @GetMapping("/me")
    public ApiResponse<Responses.Profile> me(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(userService.currentUser(userId));
    }

    @PutMapping("/me")
    public ApiResponse<Responses.Profile> update(@RequestHeader("X-User-Id") String userId,
                                                 @Valid @RequestBody Requests.UpdateProfile request) {
        return ApiResponse.ok(userService.update(userId, request));
    }

    @PutMapping("/me/password")
    public ApiResponse<Map<String, Boolean>> changePassword(@RequestHeader("X-User-Id") String userId,
                                                            @Valid @RequestBody Requests.ChangePassword request) {
        authService.changePassword(userId, request);
        return ApiResponse.ok(Map.of("changed", true));
    }

    /** Find people by e-mail, phone number or display name. */
    @GetMapping("/search")
    public ApiResponse<List<Responses.PublicUser>> search(@RequestHeader("X-User-Id") String userId,
                                                          @RequestParam("q") String keyword) {
        return ApiResponse.ok(userService.search(userId, keyword));
    }

    /** Public profiles of several users at once: /api/users?ids=a,b,c */
    @GetMapping
    public ApiResponse<List<Responses.PublicUser>> byIds(@RequestParam List<String> ids) {
        return ApiResponse.ok(userService.byIds(ids.stream().limit(200).toList()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Responses.PublicUser> profile(@RequestHeader("X-User-Id") String userId,
                                                     @PathVariable String id) {
        return ApiResponse.ok(userService.publicProfile(userId, id));
    }
}
