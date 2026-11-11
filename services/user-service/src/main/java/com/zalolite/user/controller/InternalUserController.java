package com.zalolite.user.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Service-to-service API. /internal/** is never routed by the gateway. */
@RestController
@RequestMapping("/internal/users")
public class InternalUserController {
    private final UserService users;
    private final com.zalolite.user.service.FriendService friends;

    public InternalUserController(UserService users, com.zalolite.user.service.FriendService friends) {
        this.users = users;
        this.friends = friends;
    }

    @GetMapping
    public ApiResponse<List<Responses.PublicUser>> byIds(@RequestParam List<String> ids) {
        return ApiResponse.ok(users.byIds(ids));
    }

    @GetMapping("/friends")
    public ApiResponse<Boolean> areFriends(@RequestParam String a, @RequestParam String b) {
        return ApiResponse.ok(friends.areFriends(a, b));
    }
}
