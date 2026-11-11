package com.zalolite.chat.domain;

/** Snapshot of the quoted message so a reply still renders after the original is recalled. */
public record ReplyRef(String id, String senderId, MessageType type, String preview) {
}
