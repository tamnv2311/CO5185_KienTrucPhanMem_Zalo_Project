package com.zalolite.group.service;

import com.zalolite.group.dto.request.CreateGroupRequest;
import com.zalolite.group.dto.response.GroupResponse;

import java.util.List;

public interface GroupService {
    GroupResponse create(String ownerId, CreateGroupRequest request);
    List<GroupResponse> myGroups(String userId);
    List<String> memberIds(String groupId);
    boolean canAccess(String groupId, String userId);
    void addMember(String managerId, String groupId, String memberId);
    void removeMember(String managerId, String groupId, String memberId);
    void changeRole(String managerId, String groupId, String memberId, com.zalolite.group.domain.GroupRole role);
    void update(String managerId, String groupId, String name, String avatar);
    void delete(String ownerId, String groupId);
    void leave(String userId, String groupId);
}
