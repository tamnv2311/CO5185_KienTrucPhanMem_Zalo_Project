package com.zalolite.chat.controller;

import com.zalolite.chat.dto.ChatDtos.PresenceResponse;
import com.zalolite.chat.service.PresenceService;
import com.zalolite.common.core.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat/presence")
public class PresenceController {
    private final PresenceService presence;

    public PresenceController(PresenceService presence) {
        this.presence = presence;
    }

    /** Online state of several users: /api/chat/presence?ids=a,b,c */
    @GetMapping
    public ApiResponse<List<PresenceResponse>> statuses(@RequestParam List<String> ids) {
        return ApiResponse.ok(presence.status(ids));
    }

    @GetMapping("/{userId}")
    public ApiResponse<PresenceResponse> status(@PathVariable String userId) {
        return ApiResponse.ok(presence.status(userId));
    }
}
