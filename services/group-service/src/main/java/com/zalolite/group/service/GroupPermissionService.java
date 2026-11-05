package com.zalolite.group.service;

import com.zalolite.group.domain.GroupRole;

public interface GroupPermissionService {
    boolean canManage(String groupId, String userId);
    void requireManage(String groupId, String userId);
    void requireMember(String groupId, String userId);
    GroupRole role(String groupId, String userId);
}
