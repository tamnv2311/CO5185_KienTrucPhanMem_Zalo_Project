package com.zalolite.chat.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Per-conversation message counter backed by Redis INCR (atomic across instances). */
@Service
public class SequenceService {
    private final StringRedisTemplate redis;

    public SequenceService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * @param lastKnownSeq highest seq stored in MongoDB; used to repair the counter when Redis lost its data
     */
    public long next(String conversationId, long lastKnownSeq) {
        String key = "chat:seq:" + conversationId;
        Long value = redis.opsForValue().increment(key);
        if (value == null || value <= lastKnownSeq) {
            redis.opsForValue().set(key, String.valueOf(lastKnownSeq));
            value = redis.opsForValue().increment(key);
        }
        return value == null ? lastKnownSeq + 1 : value;
    }
}
