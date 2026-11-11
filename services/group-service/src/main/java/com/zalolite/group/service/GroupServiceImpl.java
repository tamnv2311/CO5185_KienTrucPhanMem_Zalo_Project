package com.zalolite.group.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.common.events.Events;
import com.zalolite.group.client.UserClient;
import com.zalolite.group.client.UserClient.UserSummary;
import com.zalolite.group.domain.Group;
import com.zalolite.group.domain.GroupMember;
import com.zalolite.group.domain.GroupRole;
import com.zalolite.group.dto.GroupDtos;
import com.zalolite.group.repository.GroupMemberRepository;
import com.zalolite.group.repository.GroupRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class GroupServiceImpl implements GroupService {
    private final GroupRepository groups;
    private final GroupMemberRepository members;
    private final GroupPermissionService permissions;
    private final UserClient users;
    private final EventPublisher events;
    private final int maxMembers;

    public GroupServiceImpl(GroupRepository groups, GroupMemberRepository members,
                            GroupPermissionService permissions, UserClient users, EventPublisher events,
                            @Value("${group.max-members:200}") int maxMembers) {
        this.groups = groups;
        this.members = members;
        this.permissions = permissions;
        this.users = users;
        this.events = events;
        this.maxMembers = maxMembers;
    }

    @Override
    @Transactional
    public GroupDtos.GroupResponse create(String ownerId, GroupDtos.CreateGroup request) {
        Set<String> wanted = new LinkedHashSet<>();
        wanted.add(ownerId);
        if (request.memberIds() != null) {
            wanted.addAll(request.memberIds());
        }
        // Only real accounts can be members; unknown ids are ignored.
        Map<String, UserSummary> known = users.find(wanted);
        if (!known.containsKey(ownerId)) {
            throw BusinessException.notFound("Không tìm thấy người dùng");
        }
        if (known.size() > maxMembers) {
            throw new BusinessException("Nhóm chỉ được tối đa " + maxMembers + " thành viên");
        }

        Group group = new Group();
        group.setId(UUID.randomUUID().toString());
        group.setName(request.name().trim());
        group.setDescription(blankToNull(request.description()));
        group.setAvatar(blankToNull(request.avatar()));
        group.setOwnerId(ownerId);
        groups.save(group);

        saveMember(group.getId(), ownerId, GroupRole.OWNER);
        List<String> memberIds = new ArrayList<>(List.of(ownerId));
        for (String memberId : wanted) {
            if (!memberId.equals(ownerId) && known.containsKey(memberId)) {
                saveMember(group.getId(), memberId, GroupRole.MEMBER);
                memberIds.add(memberId);
            }
        }

        Map<String, Object> payload = groupPayload(group, ownerId, known);
        payload.put("memberIds", memberIds);
        events.publish(Events.GROUP_CREATED, payload);
        return toResponse(group, ownerId, known);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupDtos.GroupResponse> myGroups(String userId) {
        List<GroupDtos.GroupResponse> result = new ArrayList<>();
        for (GroupMember membership : members.findByUserId(userId)) {
            groups.findById(membership.getGroupId()).ifPresent(group -> result.add(new GroupDtos.GroupResponse(
                    group.getId(), group.getName(), group.getDescription(), group.getAvatar(), group.getOwnerId(),
                    members.countByGroupId(group.getId()), membership.getRole(), group.getCreatedAt(), null)));
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public GroupDtos.GroupResponse get(String userId, String groupId) {
        Group group = require(groupId);
        permissions.requireMember(groupId, userId);
        return toResponse(group, userId, null);
    }

    @Override
    @Transactional
    public GroupDtos.GroupResponse update(String actorId, String groupId, GroupDtos.UpdateGroup request) {
        Group group = require(groupId);
        permissions.requireManage(groupId, actorId);
        if (request.name() != null && !request.name().isBlank()) {
            group.setName(request.name().trim());
        }
        if (request.description() != null) {
            group.setDescription(blankToNull(request.description()));
        }
        if (request.avatar() != null) {
            group.setAvatar(blankToNull(request.avatar()));
        }
        groups.save(group);
        events.publish(Events.GROUP_UPDATED, groupPayload(group, actorId, users.findQuietly(List.of(actorId))));
        return toResponse(group, actorId, null);
    }

    @Override
    @Transactional
    public void delete(String ownerId, String groupId) {
        Group group = require(groupId);
        if (!ownerId.equals(group.getOwnerId())) {
            throw BusinessException.forbidden("Chỉ trưởng nhóm mới được giải tán nhóm");
        }
        disband(group, ownerId);
    }

    @Override
    @Transactional
    public GroupDtos.GroupResponse addMembers(String actorId, String groupId, List<String> userIds) {
        Group group = require(groupId);
        permissions.requireMember(groupId, actorId);
        Set<String> wanted = new LinkedHashSet<>(userIds);
        if (wanted.isEmpty()) {
            throw new BusinessException(422, "Chưa chọn thành viên để thêm");
        }
        Set<String> lookup = new LinkedHashSet<>(wanted);
        lookup.add(actorId);
        Map<String, UserSummary> known = users.find(lookup);

        List<String> added = new ArrayList<>();
        for (String userId : wanted) {
            if (!known.containsKey(userId)) {
                throw BusinessException.notFound("Không tìm thấy người dùng");
            }
            if (members.findByGroupIdAndUserId(groupId, userId).isEmpty()) {
                added.add(userId);
            }
        }
        if (added.isEmpty()) {
            throw BusinessException.conflict("Người dùng đã ở trong nhóm");
        }
        if (members.countByGroupId(groupId) + added.size() > maxMembers) {
            throw new BusinessException("Nhóm chỉ được tối đa " + maxMembers + " thành viên");
        }
        added.forEach(userId -> saveMember(groupId, userId, GroupRole.MEMBER));

        Map<String, Object> payload = groupPayload(group, actorId, known);
        payload.put("userIds", added);
        payload.put("userNames", added.stream().map(id -> known.get(id).displayName()).toList());
        events.publish(Events.GROUP_MEMBER_ADDED, payload);
        return toResponse(group, actorId, null);
    }

    @Override
    @Transactional
    public void removeMember(String actorId, String groupId, String memberId) {
        Group group = require(groupId);
        if (actorId.equals(memberId)) {
            throw new BusinessException("Hãy dùng chức năng rời nhóm");
        }
        GroupRole actorRole = permissions.role(groupId, actorId);
        GroupMember target = members.findByGroupIdAndUserId(groupId, memberId)
                .orElseThrow(() -> BusinessException.notFound("Người dùng không ở trong nhóm"));
        boolean allowed = actorRole == GroupRole.OWNER
                || (actorRole == GroupRole.ADMIN && target.getRole() == GroupRole.MEMBER);
        if (!allowed) {
            throw BusinessException.forbidden("Bạn không có quyền xóa thành viên này");
        }
        members.delete(target);
        publishRemoved(group, actorId, memberId, "removed");
    }

    @Override
    @Transactional
    public void leave(String userId, String groupId) {
        Group group = require(groupId);
        GroupMember member = members.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> BusinessException.notFound("Bạn không ở trong nhóm này"));
        if (member.getRole() == GroupRole.OWNER) {
            if (members.countByGroupId(groupId) > 1) {
                throw new BusinessException("Hãy chuyển quyền trưởng nhóm trước khi rời nhóm");
            }
            disband(group, userId); // the last person leaving closes the group
            return;
        }
        members.delete(member);
        publishRemoved(group, userId, userId, "left");
    }

    @Override
    @Transactional
    public void changeRole(String ownerId, String groupId, String memberId, GroupRole role) {
        Group group = require(groupId);
        if (permissions.role(groupId, ownerId) != GroupRole.OWNER) {
            throw BusinessException.forbidden("Chỉ trưởng nhóm mới được bổ nhiệm hoặc gỡ phó nhóm");
        }
        GroupMember member = members.findByGroupIdAndUserId(groupId, memberId)
                .orElseThrow(() -> BusinessException.notFound("Người dùng không ở trong nhóm"));
        if (member.getRole() == GroupRole.OWNER || role == GroupRole.OWNER) {
            throw new BusinessException("Hãy dùng chức năng chuyển quyền trưởng nhóm");
        }
        member.setRole(role);
        members.save(member);
        publishRole(group, ownerId, memberId, role);
    }

    @Override
    @Transactional
    public void transferOwnership(String ownerId, String groupId, String newOwnerId) {
        Group group = require(groupId);
        GroupMember current = members.findByGroupIdAndUserId(groupId, ownerId)
                .filter(member -> member.getRole() == GroupRole.OWNER)
                .orElseThrow(() -> BusinessException.forbidden("Chỉ trưởng nhóm mới được chuyển quyền"));
        if (ownerId.equals(newOwnerId)) {
            throw new BusinessException("Bạn đã là trưởng nhóm");
        }
        GroupMember next = members.findByGroupIdAndUserId(groupId, newOwnerId)
                .orElseThrow(() -> BusinessException.notFound("Người dùng không ở trong nhóm"));
        current.setRole(GroupRole.MEMBER);
        next.setRole(GroupRole.OWNER);
        members.save(current);
        members.save(next);
        group.setOwnerId(newOwnerId);
        groups.save(group);
        publishRole(group, ownerId, newOwnerId, GroupRole.OWNER);
    }

    @Override
    @Transactional(readOnly = true)
    public GroupDtos.GroupInfo info(String groupId) {
        Group group = require(groupId);
        return new GroupDtos.GroupInfo(group.getId(), group.getName(), group.getAvatar(), group.getOwnerId(),
                memberIds(groupId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> memberIds(String groupId) {
        return members.findByGroupIdOrderByJoinedAtAsc(groupId).stream().map(GroupMember::getUserId).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canAccess(String groupId, String userId) {
        return members.findByGroupIdAndUserId(groupId, userId).isPresent();
    }

    private void disband(Group group, String actorId) {
        List<GroupMember> all = members.findByGroupIdOrderByJoinedAtAsc(group.getId());
        Map<String, Object> payload = groupPayload(group, actorId, users.findQuietly(List.of(actorId)));
        payload.put("memberIds", all.stream().map(GroupMember::getUserId).toList());
        members.deleteAll(all);
        groups.delete(group);
        events.publish(Events.GROUP_DELETED, payload);
    }

    private void publishRemoved(Group group, String actorId, String userId, String reason) {
        Map<String, UserSummary> names = users.findQuietly(new LinkedHashSet<>(List.of(actorId, userId)));
        Map<String, Object> payload = groupPayload(group, actorId, names);
        payload.put("userId", userId);
        payload.put("userName", name(names, userId));
        payload.put("reason", reason);
        events.publish(Events.GROUP_MEMBER_REMOVED, payload);
    }

    private void publishRole(Group group, String actorId, String userId, GroupRole role) {
        Map<String, UserSummary> names = users.findQuietly(new LinkedHashSet<>(List.of(actorId, userId)));
        Map<String, Object> payload = groupPayload(group, actorId, names);
        payload.put("userId", userId);
        payload.put("userName", name(names, userId));
        payload.put("role", role.name());
        events.publish(Events.GROUP_ROLE_CHANGED, payload);
    }

    private Map<String, Object> groupPayload(Group group, String actorId, Map<String, UserSummary> names) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("groupId", group.getId());
        payload.put("name", group.getName());
        if (group.getAvatar() != null) {
            payload.put("avatar", group.getAvatar());
        }
        payload.put("ownerId", group.getOwnerId());
        payload.put("actorId", actorId);
        payload.put("actorName", name(names, actorId));
        return payload;
    }

    private static String name(Map<String, UserSummary> names, String userId) {
        UserSummary user = names.get(userId);
        return user == null || user.displayName() == null ? "Một thành viên" : user.displayName();
    }

    private GroupDtos.GroupResponse toResponse(Group group, String viewerId, Map<String, UserSummary> knownUsers) {
        List<GroupMember> rows = members.findByGroupIdOrderByJoinedAtAsc(group.getId());
        Map<String, UserSummary> profiles = knownUsers != null ? knownUsers
                : users.findQuietly(rows.stream().map(GroupMember::getUserId).toList());
        GroupRole myRole = null;
        List<GroupDtos.Member> list = new ArrayList<>();
        for (GroupMember row : rows) {
            UserSummary profile = profiles.get(row.getUserId());
            list.add(new GroupDtos.Member(row.getUserId(), row.getRole(), row.getJoinedAt(),
                    profile == null ? null : profile.displayName(), profile == null ? null : profile.avatar()));
            if (row.getUserId().equals(viewerId)) {
                myRole = row.getRole();
            }
        }
        return new GroupDtos.GroupResponse(group.getId(), group.getName(), group.getDescription(), group.getAvatar(),
                group.getOwnerId(), list.size(), myRole, group.getCreatedAt(), list);
    }

    private Group require(String groupId) {
        return groups.findById(groupId).orElseThrow(() -> BusinessException.notFound("Không tìm thấy nhóm"));
    }

    private void saveMember(String groupId, String userId, GroupRole role) {
        GroupMember member = new GroupMember();
        member.setGroupId(groupId);
        member.setUserId(userId);
        member.setRole(role);
        members.save(member);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
