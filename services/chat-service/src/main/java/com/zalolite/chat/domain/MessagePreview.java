package com.zalolite.chat.domain;

import java.time.Instant;

/** What the conversation list shows under the name. */
public record MessagePreview(String id, long seq, String senderId, MessageType type, String preview, Instant createdAt) {
}
