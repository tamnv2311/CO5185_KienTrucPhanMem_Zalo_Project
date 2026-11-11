package com.zalolite.user.dto;

import com.zalolite.user.domain.User;

import java.time.Instant;

/** Response payloads of the user service. */
public final class Responses {
    private Responses() {
    }

    public record Auth(String accessToken, String refreshToken, long expiresIn, Profile user) {
    }

    /** Full profile, only returned to its owner. */
    public record Profile(String id, String email, String phone, String displayName, String avatar, String cover,
                          String bio, String gender, String birthday, Instant createdAt) {
        public static Profile of(User user) {
            return new Profile(user.getId(), user.getEmail(), user.getPhone(), user.getDisplayName(), user.getAvatar(),
                    user.getCover(), user.getBio(), user.getGender(), user.getBirthday(), user.getCreatedAt());
        }
    }

    /**
     * What other users may see. relation is one of
     * SELF, FRIEND, REQUEST_SENT, REQUEST_RECEIVED, BLOCKED, NONE (from the viewer's point of view).
     */
    public record PublicUser(String id, String displayName, String avatar, String cover, String bio, String gender,
                             String relation, Long friendshipId) {
        public static PublicUser of(User user, String relation, Long friendshipId) {
            return new PublicUser(user.getId(), user.getDisplayName(), user.getAvatar(), user.getCover(),
                    user.getBio(), user.getGender(), relation, friendshipId);
        }
    }

    public record Friend(Long friendshipId, String status, String message, Instant createdAt, Instant updatedAt,
                         String requesterId, String recipientId, PublicUser user) {
    }
}
