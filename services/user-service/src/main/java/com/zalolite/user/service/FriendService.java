package com.zalolite.user.service;

import com.zalolite.user.domain.Friendship;

import java.util.List;

public interface FriendService {
    Friendship request(String requesterId, String recipientId);
    Friendship accept(String recipientId, Long friendshipId);
    List<Friendship> pending(String userId);
    List<Friendship> friends(String userId);
    void reject(String recipientId, Long friendshipId);
    void cancel(String requesterId, Long friendshipId);
}
