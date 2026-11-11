package com.zalolite.user.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.service.FriendService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    /** Target user: ?recipientId=... or a JSON body with userId / email / phone / target. */
    @PostMapping("/requests")
    public ApiResponse<Responses.Friend> request(@RequestHeader("X-User-Id") String userId,
                                                 @RequestParam(required = false) String recipientId,
                                                 @Valid @RequestBody(required = false) Requests.FriendRequest body) {
        Requests.FriendRequest request = recipientId != null
                ? new Requests.FriendRequest(recipientId, null, null, null, body == null ? null : body.message())
                : body == null ? new Requests.FriendRequest(null, null, null, null, null) : body;
        return ApiResponse.ok(friends.request(userId, request));
    }

    @PostMapping("/requests/{friendshipId}/accept")
    public ApiResponse<Responses.Friend> accept(@RequestHeader("X-User-Id") String userId,
                                                @PathVariable Long friendshipId) {
        return ApiResponse.ok(friends.accept(userId, friendshipId));
    }

    @PostMapping("/requests/{friendshipId}/reject")
    public ApiResponse<Void> reject(@RequestHeader("X-User-Id") String userId, @PathVariable Long friendshipId) {
        friends.reject(userId, friendshipId);
        return ApiResponse.ok(null);
    }

    @PostMapping("/requests/{friendshipId}/cancel")
    public ApiResponse<Void> cancel(@RequestHeader("X-User-Id") String userId, @PathVariable Long friendshipId) {
        friends.cancel(userId, friendshipId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/requests/pending")
    public ApiResponse<List<Responses.Friend>> pending(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(friends.incoming(userId));
    }

    @GetMapping("/requests/sent")
    public ApiResponse<List<Responses.Friend>> sent(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(friends.outgoing(userId));
    }

    @GetMapping
    public ApiResponse<List<Responses.Friend>> friends(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(friends.friends(userId));
    }

    @DeleteMapping("/{friendId}")
    public ApiResponse<Void> unfriend(@RequestHeader("X-User-Id") String userId, @PathVariable String friendId) {
        friends.unfriend(userId, friendId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/blocked")
    public ApiResponse<List<Responses.Friend>> blocked(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(friends.blocked(userId));
    }

    @PostMapping("/{targetId}/block")
    public ApiResponse<Void> block(@RequestHeader("X-User-Id") String userId, @PathVariable String targetId) {
        friends.block(userId, targetId);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{targetId}/block")
    public ApiResponse<Void> unblock(@RequestHeader("X-User-Id") String userId, @PathVariable String targetId) {
        friends.unblock(userId, targetId);
        return ApiResponse.ok(null);
    }
}
