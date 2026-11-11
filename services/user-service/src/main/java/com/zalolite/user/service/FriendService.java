package com.zalolite.user.service;

import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;

import java.util.List;

public interface FriendService {
    Responses.Friend request(String requesterId, Requests.FriendRequest request);
    Responses.Friend accept(String recipientId, Long friendshipId);
    void reject(String recipientId, Long friendshipId);
    void cancel(String requesterId, Long friendshipId);
    List<Responses.Friend> friends(String userId);
    /** Requests waiting for this user's answer. */
    List<Responses.Friend> incoming(String userId);
    /** Requests this user sent that are still pending. */
    List<Responses.Friend> outgoing(String userId);
    void unfriend(String userId, String friendId);
    void block(String userId, String targetId);
    void unblock(String userId, String targetId);
    List<Responses.Friend> blocked(String userId);
    boolean areFriends(String a, String b);
}
