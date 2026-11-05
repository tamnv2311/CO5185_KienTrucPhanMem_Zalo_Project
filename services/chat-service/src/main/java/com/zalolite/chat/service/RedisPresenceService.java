package com.zalolite.chat.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class RedisPresenceService implements PresenceService {
    private final StringRedisTemplate redis;

    public RedisPresenceService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public void connected(String userId) {
        redis.opsForValue().set("presence:" + userId, "online", Duration.ofMinutes(5));
    }

    @Override
    public void disconnected(String userId) {
        redis.delete("presence:" + userId);
    }

    @Override
    public boolean isOnline(String userId) {
        return Boolean.TRUE.equals(redis.hasKey("presence:" + userId));
    }
}
