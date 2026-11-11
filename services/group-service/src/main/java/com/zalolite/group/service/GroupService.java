package com.zalolite.group.service;

import com.zalolite.group.domain.GroupRole;
import com.zalolite.group.dto.GroupDtos;

import java.util.List;

public interface GroupService {
    GroupDtos.GroupResponse create(String ownerId, GroupDtos.CreateGroup request);
    List<GroupDtos.GroupResponse> myGroups(String userId);
    GroupDtos.GroupResponse get(String userId, String groupId);
    GroupDtos.GroupResponse update(String actorId, String groupId, GroupDtos.UpdateGroup request);
    void delete(String ownerId, String groupId);

    GroupDtos.GroupResponse addMembers(String actorId, String groupId, List<String> userIds);
    void removeMember(String actorId, String groupId, String memberId);
    void leave(String userId, String groupId);
    void changeRole(String ownerId, String groupId, String memberId, GroupRole role);
    void transferOwnership(String ownerId, String groupId, String newOwnerId);

    // internal API
    GroupDtos.GroupInfo info(String groupId);
    List<String> memberIds(String groupId);
    boolean canAccess(String groupId, String userId);
}
