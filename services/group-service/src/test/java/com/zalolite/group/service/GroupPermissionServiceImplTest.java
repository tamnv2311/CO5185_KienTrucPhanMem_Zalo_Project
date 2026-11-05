package com.zalolite.group.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.group.domain.GroupMember;
import com.zalolite.group.domain.GroupRole;
import com.zalolite.group.repository.GroupMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupPermissionServiceImplTest {
    @Mock
    private GroupMemberRepository members;

    @Test
    void ownerShouldBeAllowedToManage() {
        GroupMember owner = member(GroupRole.OWNER);
        when(members.findByGroupIdAndUserId("group-1", "owner-1"))
                .thenReturn(Optional.of(owner));
        GroupPermissionServiceImpl service = new GroupPermissionServiceImpl(members);

        service.requireManage("group-1", "owner-1");

        assertThat(service.canManage("group-1", "owner-1")).isTrue();
    }

    @Test
    void memberShouldNotBeAllowedToManage() {
        when(members.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(member(GroupRole.MEMBER)));
        GroupPermissionServiceImpl service = new GroupPermissionServiceImpl(members);

        assertThatThrownBy(() -> service.requireManage("group-1", "member-1"))
                .isInstanceOf(BusinessException.class);
    }

    private GroupMember member(GroupRole role) {
        GroupMember member = new GroupMember();
        member.setRole(role);
        return member;
    }
}
