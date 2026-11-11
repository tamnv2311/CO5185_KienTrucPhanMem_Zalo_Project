package com.zalolite.media.domain;

import java.util.Locale;

public enum MediaKind {
    IMAGE,
    VIDEO,
    FILE;

    /**
     * Only bitmap images and videos are shown inline by browsers. Everything else (including SVG and
     * HTML, which can carry scripts) is a FILE and is always served as a download.
     */
    public static MediaKind of(String mime) {
        String type = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        if (type.startsWith("image/") && !type.contains("svg")) {
            return IMAGE;
        }
        if (type.startsWith("video/")) {
            return VIDEO;
        }
        return FILE;
    }
}
