package com.zalolite.media.storage;

import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;

/** Port to the object store (Adapter pattern): local disk today, MinIO/S3 by adding another implementation. */
public interface StorageProvider {
    void store(String key, InputStream content) throws IOException;

    Resource load(String key);

    void delete(String key);
}
