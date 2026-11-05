package com.zalolite.group.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.group.domain.Group;
import com.zalolite.group.domain.GroupMember;
import com.zalolite.group.domain.GroupRole;
import com.zalolite.group.dto.request.CreateGroupRequest;
import com.zalolite.group.dto.response.GroupResponse;
import com.zalolite.group.repository.GroupMemberRepository;
import com.zalolite.group.repository.GroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
public class GroupServiceImpl implements GroupService {
    private final GroupRepository groups;
    private final GroupMemberRepository members;
    private final GroupPermissionService permissionService;

    public GroupServiceImpl(GroupRepository groups, GroupMemberRepository members,
                            GroupPermissionService permissionService) {
        this.groups = groups;
        this.members = members;
        this.permissionService = permissionService;
    }

    @Override
    @Transactional
    public GroupResponse create(String ownerId, CreateGroupRequest request) {
        Group group = new Group();
        group.setId(UUID.randomUUID().toString());
        group.setName(request.name().trim());
        group.setOwnerId(ownerId);
        groups.save(group);
        addMember(group.getId(), ownerId, GroupRole.OWNER);
        for (String memberId : new LinkedHashSet<>(request.memberIds())) {
            if (!ownerId.equals(memberId)) {
                addMember(group.getId(), memberId, GroupRole.MEMBER);
            }
        }
        return toResponse(group);
    }

    @Override
    public List<GroupResponse> myGroups(String userId) {
        return members.findAll().stream()
                .filter(member -> userId.equals(member.getUserId()))
                .map(member -> groups.findById(member.getGroupId()).orElseThrow())
                .map(this::toResponse).toList();
    }

    @Override
    public List<String> memberIds(String groupId) {
        return members.findByGroupId(groupId).stream().map(GroupMember::getUserId).toList();
    }

    @Override
    public boolean canAccess(String groupId, String userId) {
        return members.findByGroupIdAndUserId(groupId, userId).isPresent();
    }

    @Override
    public void addMember(String managerId, String groupId, String memberId) {
        permissionService.requireManage(groupId, managerId);
        if (members.findByGroupIdAndUserId(groupId, memberId).isPresent()) {
            throw new BusinessException("User is already in the group");
        }
        addMember(groupId, memberId, GroupRole.MEMBER);
    }

    @Override
    public void removeMember(String managerId, String groupId, String memberId) {
        permissionService.requireManage(groupId, managerId);
        GroupMember member = members.findByGroupIdAndUserId(groupId, memberId)
                .orElseThrow(() -> new BusinessException("Member not found"));
        if (member.getRole() == GroupRole.OWNER) {
            throw new BusinessException("Owner cannot be removed");
        }
        members.delete(member);
    }

    @Override
    public void changeRole(String managerId, String groupId, String memberId, GroupRole role) {
        permissionService.requireManage(groupId, managerId);
        GroupMember member = members.findByGroupIdAndUserId(groupId, memberId)
                .orElseThrow(() -> new BusinessException("Member not found"));
        if (member.getRole() == GroupRole.OWNER || role == GroupRole.OWNER) {
            throw new BusinessException("Owner role cannot be changed");
        }
        member.setRole(role);
        members.save(member);
    }

    @Override
    @Transactional
    public void update(String managerId, String groupId, String name, String avatar) {
        permissionService.requireManage(groupId, managerId);
        Group group = groups.findById(groupId)
                .orElseThrow(() -> new BusinessException("Group not found"));
        group.setName(name.trim());
        if (avatar != null) {
            group.setAvatar(avatar);
        }
        groups.save(group);
    }

    @Override
    @Transactional
    public void delete(String ownerId, String groupId) {
        Group group = groups.findById(groupId)
                .orElseThrow(() -> new BusinessException("Group not found"));
        if (!ownerId.equals(group.getOwnerId())) {
            throw new BusinessException("Only owner may delete the group");
        }
        members.deleteAll(members.findByGroupId(groupId));
        groups.delete(group);
    }

    @Override
    @Transactional
    public void leave(String userId, String groupId) {
        GroupMember member = members.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new BusinessException("Member not found"));
        if (member.getRole() == GroupRole.OWNER) {
            throw new BusinessException("Owner must transfer ownership before leaving");
        }
        members.delete(member);
    }

    private void addMember(String groupId, String userId, GroupRole role) {
        GroupMember member = new GroupMember();
        member.setGroupId(groupId);
        member.setUserId(userId);
        member.setRole(role);
        members.save(member);
    }

    private GroupResponse toResponse(Group group) {
        return new GroupResponse(group.getId(), group.getName(), group.getOwnerId(), group.getAvatar());
    }
}
