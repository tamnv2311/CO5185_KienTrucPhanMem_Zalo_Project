package com.zalolite.chat.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Optional;

/** Synchronous view of group-service, used only when the chat side has no local copy yet. */
public interface GroupClient {
    /** Empty when the group does not exist or group-service cannot be reached. */
    Optional<GroupInfo> find(String groupId);

    boolean canAccess(String groupId, String userId);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GroupInfo(String id, String name, String avatar, String ownerId, List<String> memberIds) {
    }
}
