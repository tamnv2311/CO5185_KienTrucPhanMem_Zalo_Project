package com.zalolite.chat.controller;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.dto.request.SendMessageRequest;
import com.zalolite.chat.service.MessageService;
import com.zalolite.common.core.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class MessageController {
    private final MessageService messages;

    public MessageController(MessageService messages) {
        this.messages = messages;
    }

    @PostMapping("/messages")
    public ApiResponse<Message> send(@RequestHeader("X-User-Id") String userId,
                                     @Valid @RequestBody SendMessageRequest request) {
        return ApiResponse.ok(messages.send(request.conversationId(), userId,
                request.clientMsgId(), request.content()));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ApiResponse<List<Message>> history(@RequestHeader("X-User-Id") String userId,
                                               @PathVariable String conversationId,
                                               @RequestParam(defaultValue = "50") int limit,
                                               @RequestParam(required = false) Long beforeSeq) {
        return ApiResponse.ok(messages.history(conversationId, userId, limit, beforeSeq));
    }

    @PostMapping("/messages/{messageId}/delivered")
    public ApiResponse<Message> delivered(@RequestHeader("X-User-Id") String userId,
                                          @PathVariable String messageId) {
        return ApiResponse.ok(messages.markDelivered(messageId, userId));
    }

    @PostMapping("/messages/{messageId}/seen")
    public ApiResponse<Message> seen(@RequestHeader("X-User-Id") String userId,
                                     @PathVariable String messageId) {
        return ApiResponse.ok(messages.markSeen(messageId, userId));
    }
}
