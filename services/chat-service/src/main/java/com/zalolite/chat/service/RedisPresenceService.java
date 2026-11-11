package com.zalolite.chat.service;

import com.zalolite.chat.dto.ChatDtos.PresenceResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * A user is online while at least one WebSocket session is open (several tabs/devices are fine).
 * Sessions live in a Redis set so every chat-service instance sees the same picture.
 */
@Service
public class RedisPresenceService implements PresenceService {
    private static final Duration SESSION_TTL = Duration.ofHours(12);

    private final StringRedisTemplate redis;
    private final RealtimeService realtime;

    public RedisPresenceService(StringRedisTemplate redis, RealtimeService realtime) {
        this.redis = redis;
        this.realtime = realtime;
    }

    @Override
    public void connected(String userId, String sessionId) {
        boolean wasOnline = isOnline(userId);
        redis.opsForSet().add(sessionsKey(userId), sessionId);
        redis.expire(sessionsKey(userId), SESSION_TTL);
        if (!wasOnline) {
            realtime.presence(new PresenceResponse(userId, true, null));
        }
    }

    @Override
    public void disconnected(String userId, String sessionId) {
        redis.opsForSet().remove(sessionsKey(userId), sessionId);
        if (!isOnline(userId)) {
            Instant now = Instant.now();
            redis.opsForValue().set(lastSeenKey(userId), now.toString(), Duration.ofDays(30));
            realtime.presence(new PresenceResponse(userId, false, now));
        }
    }

    @Override
    public boolean isOnline(String userId) {
        Long sessions = redis.opsForSet().size(sessionsKey(userId));
        return sessions != null && sessions > 0;
    }

    @Override
    public PresenceResponse status(String userId) {
        boolean online = isOnline(userId);
        String lastSeen = online ? null : redis.opsForValue().get(lastSeenKey(userId));
        return new PresenceResponse(userId, online, lastSeen == null ? null : Instant.parse(lastSeen));
    }

    @Override
    public List<PresenceResponse> status(Collection<String> userIds) {
        return userIds.stream().distinct().limit(500).map(this::status).toList();
    }

    private static String sessionsKey(String userId) {
        return "presence:sessions:" + userId;
    }

    private static String lastSeenKey(String userId) {
        return "presence:last:" + userId;
    }
}
