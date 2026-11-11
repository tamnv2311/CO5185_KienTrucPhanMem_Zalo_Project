package com.zalolite.group.dto;

import com.zalolite.group.domain.GroupRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Request and response payloads of the group service. */
public final class GroupDtos {
    private GroupDtos() {
    }

    public record CreateGroup(@NotBlank @Size(max = 80) String name, @Size(max = 500) String description,
                              String avatar, List<String> memberIds) {
    }

    /** Partial update: null fields are left untouched. */
    public record UpdateGroup(@Size(max = 80) String name, @Size(max = 500) String description, String avatar) {
    }

    /** One user (userId) or several (userIds). */
    public record AddMembers(String userId, List<String> userIds) {
        public List<String> all() {
            List<String> ids = new ArrayList<>();
            if (userId != null && !userId.isBlank()) {
                ids.add(userId);
            }
            if (userIds != null) {
                ids.addAll(userIds);
            }
            return ids;
        }
    }

    public record ChangeRole(@NotNull GroupRole role) {
    }

    public record TransferOwnership(@NotBlank String userId) {
    }

    public record Member(String userId, GroupRole role, Instant joinedAt, String displayName, String avatar) {
    }

    public record GroupResponse(String id, String name, String description, String avatar, String ownerId,
                                int memberCount, GroupRole myRole, Instant createdAt, List<Member> members) {
    }

    /** Minimal view for other services. */
    public record GroupInfo(String id, String name, String avatar, String ownerId, List<String> memberIds) {
    }
}
