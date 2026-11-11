package com.zalolite.group.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.group.client.UserClient;
import com.zalolite.group.client.UserClient.UserSummary;
import com.zalolite.group.domain.Group;
import com.zalolite.group.domain.GroupMember;
import com.zalolite.group.domain.GroupRole;
import com.zalolite.group.dto.GroupDtos;
import com.zalolite.group.repository.GroupMemberRepository;
import com.zalolite.group.repository.GroupRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupServiceImplTest {
    @Mock
    private GroupRepository groups;
    @Mock
    private GroupMemberRepository members;
    @Mock
    private UserClient users;
    @Mock
    private EventPublisher events;

    private GroupServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new GroupServiceImpl(groups, members, new GroupPermissionServiceImpl(members), users, events, 200);
        lenient().when(groups.findById("g1")).thenReturn(Optional.of(group("g1", "an")));
        lenient().when(users.findQuietly(anyCollection())).thenReturn(Map.of());
    }

    @Test
    void createKeepsOnlyExistingUsersAndMakesTheCreatorOwner() {
        when(users.find(anyCollection())).thenAnswer(call -> known(call.getArgument(0), "an", "binh"));

        GroupDtos.GroupResponse response = service.create("an",
                new GroupDtos.CreateGroup(" Nhóm lớp ", null, null, List.of("binh", "ghost", "binh")));

        assertThat(response.name()).isEqualTo("Nhóm lớp");
        ArgumentCaptor<GroupMember> saved = ArgumentCaptor.forClass(GroupMember.class);
        verify(members, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(GroupMember::getUserId).containsExactly("an", "binh");
        assertThat(saved.getAllValues().get(0).getRole()).isEqualTo(GroupRole.OWNER);
        verify(events).publish(eq("group.created"), any());
    }

    @Test
    void memberLeavingPublishesTheRemoval() {
        GroupMember binh = member("g1", "binh", GroupRole.MEMBER);
        when(members.findByGroupIdAndUserId("g1", "binh")).thenReturn(Optional.of(binh));

        service.leave("binh", "g1");

        verify(members).delete(binh);
        verify(events).publish(eq("group.member_removed"), any());
    }

    @Test
    void ownerCannotLeaveWhileOthersRemain() {
        when(members.findByGroupIdAndUserId("g1", "an")).thenReturn(Optional.of(member("g1", "an", GroupRole.OWNER)));
        when(members.countByGroupId("g1")).thenReturn(3);

        assertThatThrownBy(() -> service.leave("an", "g1")).isInstanceOf(BusinessException.class);
        verify(members, never()).delete(any());
    }

    @Test
    void deputyCannotRemoveAnotherDeputy() {
        when(members.findByGroupIdAndUserId("g1", "binh")).thenReturn(Optional.of(member("g1", "binh", GroupRole.ADMIN)));
        when(members.findByGroupIdAndUserId("g1", "chi")).thenReturn(Optional.of(member("g1", "chi", GroupRole.ADMIN)));

        assertThatThrownBy(() -> service.removeMember("binh", "g1", "chi"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(403);
    }

    @Test
    void onlyTheOwnerAppointsDeputies() {
        when(members.findByGroupIdAndUserId("g1", "binh")).thenReturn(Optional.of(member("g1", "binh", GroupRole.ADMIN)));

        assertThatThrownBy(() -> service.changeRole("binh", "g1", "chi", GroupRole.ADMIN))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(403);
    }

    private static Map<String, UserSummary> known(Collection<String> asked, String... existing) {
        Map<String, UserSummary> result = new LinkedHashMap<>();
        for (String id : existing) {
            if (asked.contains(id)) {
                result.put(id, new UserSummary(id, id, null));
            }
        }
        return result;
    }

    private static Group group(String id, String ownerId) {
        Group group = new Group();
        group.setId(id);
        group.setName("Nhóm");
        group.setOwnerId(ownerId);
        return group;
    }

    private static GroupMember member(String groupId, String userId, GroupRole role) {
        GroupMember member = new GroupMember();
        member.setGroupId(groupId);
        member.setUserId(userId);
        member.setRole(role);
        return member;
    }
}
