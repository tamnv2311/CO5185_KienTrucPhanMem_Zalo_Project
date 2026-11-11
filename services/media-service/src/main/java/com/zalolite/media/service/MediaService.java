package com.zalolite.media.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.common.events.Events;
import com.zalolite.media.domain.Media;
import com.zalolite.media.domain.MediaKind;
import com.zalolite.media.repository.MediaRepository;
import com.zalolite.media.storage.StorageProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Service
public class MediaService {
    private final MediaRepository repository;
    private final StorageProvider storage;
    private final EventPublisher events;
    private final Map<MediaKind, Long> maxBytes;

    public MediaService(MediaRepository repository, StorageProvider storage, EventPublisher events,
                        @Value("${media.max-size-mb.image:10}") long imageMb,
                        @Value("${media.max-size-mb.video:100}") long videoMb,
                        @Value("${media.max-size-mb.file:50}") long fileMb) {
        this.repository = repository;
        this.storage = storage;
        this.events = events;
        this.maxBytes = Map.of(MediaKind.IMAGE, imageMb << 20, MediaKind.VIDEO, videoMb << 20, MediaKind.FILE, fileMb << 20);
    }

    public Media upload(String ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(422, "Tệp rỗng");
        }
        String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        MediaKind kind = MediaKind.of(mime);
        if (file.getSize() > maxBytes.get(kind)) {
            throw new BusinessException(413, "Tệp vượt quá " + (maxBytes.get(kind) >> 20) + "MB");
        }

        Media media = new Media();
        media.setId(UUID.randomUUID().toString());
        media.setOwnerId(ownerId);
        media.setName(safeName(file.getOriginalFilename()));
        media.setMime(mime);
        media.setSize(file.getSize());
        media.setKind(kind);
        // The id is the only path component that comes from us; the original name is never used on disk.
        media.setStorageKey(LocalDate.now() + "/" + media.getId());
        try (InputStream content = file.getInputStream()) {
            storage.store(media.getStorageKey(), content);
        } catch (IOException exception) {
            throw new BusinessException(500, "Không lưu được tệp, vui lòng thử lại");
        }
        repository.save(media);
        events.publish(Events.MEDIA_UPLOADED, Map.of(
                "mediaId", media.getId(), "ownerId", ownerId, "kind", kind.name(), "size", media.getSize()));
        return media;
    }

    public Media require(String id) {
        return repository.findById(id).orElseThrow(() -> BusinessException.notFound("Không tìm thấy tệp"));
    }

    public void delete(String userId, String id) {
        Media media = require(id);
        if (!userId.equals(media.getOwnerId())) {
            throw BusinessException.forbidden("Bạn không thể xóa tệp của người khác");
        }
        repository.delete(media);
        storage.delete(media.getStorageKey());
    }

    static String safeName(String original) {
        if (original == null || original.isBlank()) {
            return "file";
        }
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (name.length() > 150) {
            name = name.substring(name.length() - 150);
        }
        return name.isEmpty() ? "file" : name;
    }
}
