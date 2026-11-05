package com.zalolite.user.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.user.domain.Friendship;
import com.zalolite.user.service.FriendService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
public class FriendController {
    private final FriendService friends;

    public FriendController(FriendService friends) {
        this.friends = friends;
    }

    @PostMapping("/requests")
    public ApiResponse<Friendship> request(@RequestHeader("X-User-Id") String userId,
                                           @RequestParam String recipientId) {
        return ApiResponse.ok(friends.request(userId, recipientId));
    }

    @PostMapping("/requests/{friendshipId}/accept")
    public ApiResponse<Friendship> accept(@RequestHeader("X-User-Id") String userId,
                                          @PathVariable Long friendshipId) {
        return ApiResponse.ok(friends.accept(userId, friendshipId));
    }

    @GetMapping("/requests/pending")
    public ApiResponse<List<Friendship>> pending(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(friends.pending(userId));
    }

    @GetMapping
    public ApiResponse<List<Friendship>> friends(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(friends.friends(userId));
    }

    @PostMapping("/requests/{friendshipId}/reject")
    public ApiResponse<Void> reject(@RequestHeader("X-User-Id") String userId,
                                    @PathVariable Long friendshipId) {
        friends.reject(userId, friendshipId);
        return ApiResponse.ok(null);
    }

    @PostMapping("/requests/{friendshipId}/cancel")
    public ApiResponse<Void> cancel(@RequestHeader("X-User-Id") String userId,
                                    @PathVariable Long friendshipId) {
        friends.cancel(userId, friendshipId);
        return ApiResponse.ok(null);
    }
}
