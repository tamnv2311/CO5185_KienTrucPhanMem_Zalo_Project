package com.zalolite.chat.domain;

/** Reference to a file stored by media-service. */
public record Attachment(String mediaId, String url, String name, Long size, String mime, String kind) {
}
