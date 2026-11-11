package com.zalolite.media.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.media.domain.Media;
import com.zalolite.media.domain.MediaKind;
import com.zalolite.media.service.MediaService;
import com.zalolite.media.storage.StorageProvider;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/media")
public class MediaController {
    private static final long MAX_RANGE_BYTES = 2L << 20;

    private final MediaService media;
    private final StorageProvider storage;

    public MediaController(MediaService media, StorageProvider storage) {
        this.media = media;
        this.storage = storage;
    }

    public record MediaResponse(String id, String url, String name, long size, String mime, MediaKind kind,
                                Instant createdAt) {
        static MediaResponse of(Media media) {
            return new MediaResponse(media.getId(), "/api/media/" + media.getId() + "/content", media.getName(),
                    media.getSize(), media.getMime(), media.getKind(), media.getCreatedAt());
        }
    }

    /** multipart/form-data with a "file" part. The response can be used directly as a message attachment. */
    @PostMapping
    public ApiResponse<MediaResponse> upload(@RequestHeader("X-User-Id") String userId,
                                             @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(MediaResponse.of(media.upload(userId, file)));
    }

    @GetMapping("/{id}")
    public ApiResponse<MediaResponse> metadata(@PathVariable String id) {
        return ApiResponse.ok(MediaResponse.of(media.require(id)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@RequestHeader("X-User-Id") String userId, @PathVariable String id) {
        media.delete(userId, id);
        return ApiResponse.ok(null);
    }

    /**
     * Streams the file. Public by design (the id is an unguessable UUID) so img/video tags can load it.
     * Supports HTTP Range so videos can seek.
     */
    @GetMapping("/{id}/content")
    public ResponseEntity<?> content(@PathVariable String id, @RequestHeader HttpHeaders requestHeaders) {
        Media found = media.require(id);
        Resource resource = storage.load(found.getStorageKey());
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        boolean inline = found.getKind() != MediaKind.FILE;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(inline ? parse(found.getMime()) : MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDisposition((inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(found.getName(), StandardCharsets.UTF_8).build());
        headers.setCacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic());
        // Never let the browser guess a type: an uploaded HTML file must not run as a page.
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");

        List<HttpRange> ranges;
        try {
            ranges = requestHeaders.getRange();
        } catch (IllegalArgumentException malformed) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).build();
        }
        if (ranges.isEmpty()) {
            return ResponseEntity.ok().headers(headers).contentLength(found.getSize()).body(resource);
        }
        ResourceRegion requested;
        try {
            requested = ranges.get(0).toResourceRegion(resource);
        } catch (IllegalArgumentException outOfBounds) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).build();
        }
        ResourceRegion region = new ResourceRegion(resource, requested.getPosition(),
                Math.min(requested.getCount(), MAX_RANGE_BYTES));
        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).headers(headers).body(region);
    }

    private static MediaType parse(String mime) {
        try {
            return MediaType.parseMediaType(mime);
        } catch (RuntimeException invalid) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
