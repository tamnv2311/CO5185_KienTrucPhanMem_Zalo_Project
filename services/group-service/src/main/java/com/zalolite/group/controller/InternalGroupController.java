package com.zalolite.group.controller;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.group.service.GroupService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/internal/groups")
public class InternalGroupController {
    private final GroupService groups;

    public InternalGroupController(GroupService groups) {
        this.groups = groups;
    }

    @GetMapping("/{groupId}/members")
    public ApiResponse<List<String>> members(@PathVariable String groupId) {
        return ApiResponse.ok(groups.memberIds(groupId));
    }

    @GetMapping("/{groupId}/access")
    public ApiResponse<Boolean> access(@PathVariable String groupId,
                                       @RequestParam String userId) {
        return ApiResponse.ok(groups.canAccess(groupId, userId));
    }
}
