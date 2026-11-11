package com.zalolite.chat.service;

import com.zalolite.chat.dto.ChatDtos.PresenceResponse;

import java.util.Collection;
import java.util.List;

public interface PresenceService {
    void connected(String userId, String sessionId);
    void disconnected(String userId, String sessionId);
    boolean isOnline(String userId);
    PresenceResponse status(String userId);
    List<PresenceResponse> status(Collection<String> userIds);
}
