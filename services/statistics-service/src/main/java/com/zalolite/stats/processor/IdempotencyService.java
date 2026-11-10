package com.zalolite.stats.processor;

public interface IdempotencyService {
    boolean markProcessed(String eventId);
}
