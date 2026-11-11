package com.zalolite.media;

import com.zalolite.media.domain.MediaKind;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MediaRulesTest {
    @Test
    void bitmapImagesAndVideosAreInlineKinds() {
        assertThat(MediaKind.of("image/png")).isEqualTo(MediaKind.IMAGE);
        assertThat(MediaKind.of("VIDEO/mp4")).isEqualTo(MediaKind.VIDEO);
    }

    @Test
    void scriptableOrUnknownTypesAreDownloadsOnly() {
        assertThat(MediaKind.of("image/svg+xml")).isEqualTo(MediaKind.FILE);
        assertThat(MediaKind.of("text/html")).isEqualTo(MediaKind.FILE);
        assertThat(MediaKind.of(null)).isEqualTo(MediaKind.FILE);
    }
}
