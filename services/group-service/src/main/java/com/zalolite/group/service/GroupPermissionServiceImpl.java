package com.zalolite.group.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.group.domain.GroupMember;
import com.zalolite.group.domain.GroupRole;
import com.zalolite.group.repository.GroupMemberRepository;
import org.springframework.stereotype.Service;

@Service
public class GroupPermissionServiceImpl implements GroupPermissionService {
    private final GroupMemberRepository members;

    public GroupPermissionServiceImpl(GroupMemberRepository members) {
        this.members = members;
    }

    @Override
    public boolean canManage(String groupId, String userId) {
        return members.findByGroupIdAndUserId(groupId, userId)
                .map(member -> member.getRole() != GroupRole.MEMBER)
                .orElse(false);
    }

    @Override
    public void requireManage(String groupId, String userId) {
        if (!canManage(groupId, userId)) {
            throw new BusinessException("Only owner or admin may perform this action");
        }
    }

    @Override
    public void requireMember(String groupId, String userId) {
        if (members.findByGroupIdAndUserId(groupId, userId).isEmpty()) {
            throw new BusinessException("User is not a group member");
        }
    }

    @Override
    public GroupRole role(String groupId, String userId) {
        return members.findByGroupIdAndUserId(groupId, userId)
                .map(GroupMember::getRole)
                .orElseThrow(() -> new BusinessException("User is not a group member"));
    }
}
