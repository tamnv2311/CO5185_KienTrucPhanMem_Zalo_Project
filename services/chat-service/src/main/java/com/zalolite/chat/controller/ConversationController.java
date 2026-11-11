package com.zalolite.chat.controller;

import com.zalolite.chat.dto.ChatDtos.ConversationResponse;
import com.zalolite.chat.dto.ChatDtos.MessageResponse;
import com.zalolite.chat.dto.ChatDtos.ReceiptRequest;
import com.zalolite.chat.dto.ChatDtos.SettingsRequest;
import com.zalolite.chat.service.ConversationService;
import com.zalolite.chat.service.MessageService;
import com.zalolite.common.core.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat/conversations")
public class ConversationController {
    private final ConversationService conversations;
    private final MessageService messages;

    public ConversationController(ConversationService conversations, MessageService messages) {
        this.conversations = conversations;
        this.messages = messages;
    }

    /** The chat list: newest first, pinned on top, with unread counters. */
    @GetMapping
    public ApiResponse<List<ConversationResponse>> list(@RequestHeader("X-User-Id") String userId) {
        return ApiResponse.ok(conversations.list(userId));
    }

    /** Opens (or creates) the 1-1 conversation with another user. */
    @PostMapping("/direct")
    public ApiResponse<ConversationResponse> direct(@RequestHeader("X-User-Id") String userId,
                                                    @RequestParam String peerId) {
        return ApiResponse.ok(conversations.openDirect(userId, peerId));
    }

    /** Opens the conversation of a group. Its id equals the group id. */
    @PostMapping("/group")
    public ApiResponse<ConversationResponse> group(@RequestHeader("X-User-Id") String userId,
                                                   @RequestParam String groupId) {
        return ApiResponse.ok(conversations.openGroup(userId, groupId));
    }

    @GetMapping("/{conversationId}")
    public ApiResponse<ConversationResponse> get(@RequestHeader("X-User-Id") String userId,
                                                 @PathVariable String conversationId) {
        return ApiResponse.ok(conversations.get(userId, conversationId));
    }

    /** Pin / mute, for the calling user only. */
    @PutMapping("/{conversationId}/settings")
    public ApiResponse<ConversationResponse> settings(@RequestHeader("X-User-Id") String userId,
                                                      @PathVariable String conversationId,
                                                      @RequestBody SettingsRequest request) {
        return ApiResponse.ok(conversations.updateSettings(userId, conversationId, request.pinned(), request.muted()));
    }

    @PostMapping("/{conversationId}/read")
    public ApiResponse<ConversationResponse> read(@RequestHeader("X-User-Id") String userId,
                                                  @PathVariable String conversationId,
                                                  @RequestBody(required = false) ReceiptRequest request) {
        return ApiResponse.ok(ConversationResponse.of(
                conversations.markRead(userId, conversationId, request == null ? null : request.seq()), userId));
    }

    @PostMapping("/{conversationId}/delivered")
    public ApiResponse<ConversationResponse> delivered(@RequestHeader("X-User-Id") String userId,
                                                       @PathVariable String conversationId,
                                                       @RequestBody(required = false) ReceiptRequest request) {
        return ApiResponse.ok(ConversationResponse.of(
                conversations.markDelivered(userId, conversationId, request == null ? null : request.seq()), userId));
    }

    /** "Delete conversation": clears the history for the calling user only. */
    @DeleteMapping("/{conversationId}")
    public ApiResponse<Void> clear(@RequestHeader("X-User-Id") String userId, @PathVariable String conversationId) {
        conversations.clearHistory(userId, conversationId);
        return ApiResponse.ok(null);
    }

    /** Cursor pagination by seq: ?beforeSeq= for older pages, ?afterSeq= to catch up. */
    @GetMapping("/{conversationId}/messages")
    public ApiResponse<List<MessageResponse>> history(@RequestHeader("X-User-Id") String userId,
                                                      @PathVariable String conversationId,
                                                      @RequestParam(defaultValue = "50") int limit,
                                                      @RequestParam(required = false) Long beforeSeq,
                                                      @RequestParam(required = false) Long afterSeq) {
        return ApiResponse.ok(messages.history(userId, conversationId, limit, beforeSeq, afterSeq));
    }

    @GetMapping("/{conversationId}/messages/search")
    public ApiResponse<List<MessageResponse>> search(@RequestHeader("X-User-Id") String userId,
                                                     @PathVariable String conversationId,
                                                     @RequestParam("q") String keyword) {
        return ApiResponse.ok(messages.search(userId, conversationId, keyword));
    }

    @GetMapping("/{conversationId}/pins")
    public ApiResponse<List<MessageResponse>> pins(@RequestHeader("X-User-Id") String userId,
                                                   @PathVariable String conversationId) {
        return ApiResponse.ok(messages.pinned(userId, conversationId));
    }
}
