package com.zalolite.group.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.group.dto.request.CreateGroupRequest;
import com.zalolite.group.dto.request.MemberRequest;
import com.zalolite.group.dto.request.UpdateGroupRequest;
import com.zalolite.group.dto.request.ChangeRoleRequest;
import com.zalolite.group.dto.response.GroupResponse;
import com.zalolite.group.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequestMapping("/api/groups")
public class GroupController {
    private final GroupService groups;

    public GroupController(GroupService groups) {
        this.groups = groups;
    }

    @PostMapping
    public ApiResponse<GroupResponse> create(@RequestHeader("X-User-Id") String userId,
                                             @Valid @RequestBody CreateGroupRequest request) {
        return ApiResponse.ok(groups.create(userId, request));
    }

    @GetMapping
    public ApiResponse<List<GroupResponse>> myGroups(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(groups.myGroups(userId));
    }

    @PostMapping("/{groupId}/members")
    public ApiResponse<Void> addMember(@RequestHeader("X-User-Id") String userId,
                                       @PathVariable String groupId,
                                       @Valid @RequestBody MemberRequest request) {
        groups.addMember(userId, groupId, request.userId());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{groupId}/members/{memberId}")
    public ApiResponse<Void> removeMember(@RequestHeader("X-User-Id") String userId,
                                          @PathVariable String groupId,
                                          @PathVariable String memberId) {
        groups.removeMember(userId, groupId, memberId);
        return ApiResponse.ok(null);
    }

    @PutMapping("/{groupId}")
    public ApiResponse<Void> update(@RequestHeader("X-User-Id") String userId,
                                    @PathVariable String groupId,
                                    @Valid @RequestBody UpdateGroupRequest request) {
        groups.update(userId, groupId, request.name(), request.avatar());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{groupId}")
    public ApiResponse<Void> delete(@RequestHeader("X-User-Id") String userId,
                                    @PathVariable String groupId) {
        groups.delete(userId, groupId);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{groupId}/leave")
    public ApiResponse<Void> leave(@RequestHeader("X-User-Id") String userId,
                                   @PathVariable String groupId) {
        groups.leave(userId, groupId);
        return ApiResponse.ok(null);
    }

    @PutMapping("/{groupId}/members/{memberId}/role")
    public ApiResponse<Void> changeRole(@RequestHeader("X-User-Id") String userId,
                                        @PathVariable String groupId,
                                        @PathVariable String memberId,
                                        @Valid @RequestBody ChangeRoleRequest request) {
        groups.changeRole(userId, groupId, memberId, request.role());
        return ApiResponse.ok(null);
    }
}
