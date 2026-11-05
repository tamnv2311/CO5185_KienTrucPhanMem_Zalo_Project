package com.zalolite.chat.controller;

import com.zalolite.chat.service.PresenceService;
import com.zalolite.common.core.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/chat/presence")
public class PresenceController {
    private final PresenceService presence;

    public PresenceController(PresenceService presence) {
        this.presence = presence;
    }

    @GetMapping("/{userId}")
    public ApiResponse<Map<String, Boolean>> status(@PathVariable String userId) {
        return ApiResponse.ok(Map.of("online", presence.isOnline(userId)));
    }
}
