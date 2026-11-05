package com.zalolite.chat.service;

public interface PresenceService {
    void connected(String userId);
    void disconnected(String userId);
    boolean isOnline(String userId);
}
