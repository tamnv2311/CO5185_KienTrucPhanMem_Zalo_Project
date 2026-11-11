package com.zalolite.chat.controller;

import com.zalolite.chat.dto.ChatDtos.ForwardRequest;
import com.zalolite.chat.dto.ChatDtos.MessageResponse;
import com.zalolite.chat.dto.ChatDtos.PinRequest;
import com.zalolite.chat.dto.ChatDtos.ReactionRequest;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;
import com.zalolite.chat.service.MessageService;
import com.zalolite.common.core.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat/messages")
public class MessageController {
    private final MessageService messages;

    public MessageController(MessageService messages) {
        this.messages = messages;
    }

    /** REST twin of the STOMP destination /app/chat.send. */
    @PostMapping
    public ApiResponse<MessageResponse> send(@RequestHeader("X-User-Id") String userId,
                                             @RequestBody SendMessageRequest request) {
        return ApiResponse.ok(messages.send(userId, request));
    }

    /** Recall for everyone (sender only). */
    @PostMapping("/{messageId}/recall")
    public ApiResponse<MessageResponse> recall(@RequestHeader("X-User-Id") String userId,
                                               @PathVariable String messageId) {
        return ApiResponse.ok(messages.recall(userId, messageId));
    }

    /** Delete on my side only. */
    @DeleteMapping("/{messageId}")
    public ApiResponse<Void> deleteForMe(@RequestHeader("X-User-Id") String userId, @PathVariable String messageId) {
        messages.deleteForMe(userId, messageId);
        return ApiResponse.ok(null);
    }

    /** Toggles a reaction; an empty emoji removes all of the caller's reactions. */
    @PostMapping("/{messageId}/reactions")
    public ApiResponse<MessageResponse> react(@RequestHeader("X-User-Id") String userId,
                                              @PathVariable String messageId,
                                              @RequestBody ReactionRequest request) {
        return ApiResponse.ok(messages.react(userId, messageId, request.emoji()));
    }

    @PostMapping("/{messageId}/forward")
    public ApiResponse<List<MessageResponse>> forward(@RequestHeader("X-User-Id") String userId,
                                                      @PathVariable String messageId,
                                                      @RequestBody ForwardRequest request) {
        return ApiResponse.ok(messages.forward(userId, messageId, request.conversationIds()));
    }

    @PutMapping("/{messageId}/pin")
    public ApiResponse<MessageResponse> pin(@RequestHeader("X-User-Id") String userId,
                                            @PathVariable String messageId,
                                            @RequestBody PinRequest request) {
        return ApiResponse.ok(messages.pin(userId, messageId, request.pinned()));
    }

    @PostMapping("/{messageId}/seen")
    public ApiResponse<MessageResponse> seen(@RequestHeader("X-User-Id") String userId,
                                             @PathVariable String messageId) {
        return ApiResponse.ok(messages.markSeen(userId, messageId));
    }

    @PostMapping("/{messageId}/delivered")
    public ApiResponse<MessageResponse> delivered(@RequestHeader("X-User-Id") String userId,
                                                  @PathVariable String messageId) {
        return ApiResponse.ok(messages.markDelivered(userId, messageId));
    }
}
