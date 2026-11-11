package com.zalolite.group.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.group.dto.GroupDtos;
import com.zalolite.group.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class GroupController {
    private final GroupService groups;

    public GroupController(GroupService groups) {
        this.groups = groups;
    }

    @PostMapping
    public ApiResponse<GroupDtos.GroupResponse> create(@RequestHeader("X-User-Id") String userId,
                                                       @Valid @RequestBody GroupDtos.CreateGroup request) {
        return ApiResponse.ok(groups.create(userId, request));
    }

    @GetMapping
    public ApiResponse<List<GroupDtos.GroupResponse>> myGroups(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(groups.myGroups(userId));
    }

    @GetMapping("/{groupId}")
    public ApiResponse<GroupDtos.GroupResponse> get(@RequestHeader("X-User-Id") String userId,
                                                    @PathVariable String groupId) {
        return ApiResponse.ok(groups.get(userId, groupId));
    }

    @GetMapping("/{groupId}/members")
    public ApiResponse<List<GroupDtos.Member>> members(@RequestHeader("X-User-Id") String userId,
                                                       @PathVariable String groupId) {
        return ApiResponse.ok(groups.get(userId, groupId).members());
    }

    @PutMapping("/{groupId}")
    public ApiResponse<GroupDtos.GroupResponse> update(@RequestHeader("X-User-Id") String userId,
                                                       @PathVariable String groupId,
                                                       @Valid @RequestBody GroupDtos.UpdateGroup request) {
        return ApiResponse.ok(groups.update(userId, groupId, request));
    }

    @DeleteMapping("/{groupId}")
    public ApiResponse<Void> delete(@RequestHeader("X-User-Id") String userId, @PathVariable String groupId) {
        groups.delete(userId, groupId);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{groupId}/members")
    public ApiResponse<GroupDtos.GroupResponse> addMembers(@RequestHeader("X-User-Id") String userId,
                                                           @PathVariable String groupId,
                                                           @RequestBody GroupDtos.AddMembers request) {
        return ApiResponse.ok(groups.addMembers(userId, groupId, request.all()));
    }

    @DeleteMapping("/{groupId}/members/{memberId}")
    public ApiResponse<Void> removeMember(@RequestHeader("X-User-Id") String userId,
                                          @PathVariable String groupId, @PathVariable String memberId) {
        groups.removeMember(userId, groupId, memberId);
        return ApiResponse.ok(null);
    }

    @PutMapping("/{groupId}/members/{memberId}/role")
    public ApiResponse<Void> changeRole(@RequestHeader("X-User-Id") String userId,
                                        @PathVariable String groupId, @PathVariable String memberId,
                                        @Valid @RequestBody GroupDtos.ChangeRole request) {
        groups.changeRole(userId, groupId, memberId, request.role());
        return ApiResponse.ok(null);
    }

    @PostMapping("/{groupId}/owner")
    public ApiResponse<Void> transferOwnership(@RequestHeader("X-User-Id") String userId,
                                               @PathVariable String groupId,
                                               @Valid @RequestBody GroupDtos.TransferOwnership request) {
        groups.transferOwnership(userId, groupId, request.userId());
        return ApiResponse.ok(null);
    }

    @PostMapping("/{groupId}/leave")
    public ApiResponse<Void> leave(@RequestHeader("X-User-Id") String userId, @PathVariable String groupId) {
        groups.leave(userId, groupId);
        return ApiResponse.ok(null);
    }
}
