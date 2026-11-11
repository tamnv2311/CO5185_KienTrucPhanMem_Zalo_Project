package com.zalolite.media.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Metadata of an uploaded file. The bytes live in the storage provider under storageKey. */
@Document("media")
public class Media {
    @Id
    private String id;
    private String ownerId;
    private String name;
    private String mime;
    private long size;
    private MediaKind kind;
    private String storageKey;
    private Instant createdAt = Instant.now();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getMime() { return mime; }
    public void setMime(String mime) { this.mime = mime; }
    public long getSize() { return size; }
    public void setSize(long size) { this.size = size; }
    public MediaKind getKind() { return kind; }
    public void setKind(MediaKind kind) { this.kind = kind; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public Instant getCreatedAt() { return createdAt; }
}
