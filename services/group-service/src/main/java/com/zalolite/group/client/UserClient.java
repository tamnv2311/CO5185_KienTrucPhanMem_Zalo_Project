package com.zalolite.group.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Collection;
import java.util.Map;

/** Read-only view of user-service: groups never store user data, only ids. */
public interface UserClient {
    /** Existing users by id. Throws BusinessException(503) when user-service cannot be reached. */
    Map<String, UserSummary> find(Collection<String> userIds);

    /** Same as find but returns an empty map instead of failing (for optional display data). */
    Map<String, UserSummary> findQuietly(Collection<String> userIds);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UserSummary(String id, String displayName, String avatar) {
    }
}
