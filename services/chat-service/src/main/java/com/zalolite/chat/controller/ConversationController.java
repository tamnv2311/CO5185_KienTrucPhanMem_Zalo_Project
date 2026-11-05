package com.zalolite.chat.controller;

import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.ConversationType;
import com.zalolite.chat.repository.ConversationRepository;
import com.zalolite.chat.service.MessageService;
import com.zalolite.common.core.BusinessException;
import com.zalolite.common.core.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat/conversations")
public class ConversationController {
    private final ConversationRepository conversations;
    private final MessageService messages;

    public ConversationController(ConversationRepository conversations, MessageService messages) {
        this.conversations = conversations;
        this.messages = messages;
    }

    @PostMapping("/direct")
    public ApiResponse<Conversation> direct(@RequestHeader("X-User-Id") String userId,
                                            @RequestParam String peerId) {
        if (userId.equals(peerId)) {
            throw new BusinessException("Cannot create a direct conversation with yourself");
        }
        Conversation conversation = new Conversation();
        conversation.setId(UUID.randomUUID().toString());
        conversation.setType(ConversationType.DIRECT);
        conversation.setMemberIds(List.of(userId, peerId));
        return ApiResponse.ok(conversations.save(conversation));
    }

    @PostMapping("/group")
    public ApiResponse<Conversation> group(@RequestHeader("X-User-Id") String userId,
                                           @RequestParam String groupId,
                                           @RequestParam(required = false) String peerId) {
        Conversation conversation = new Conversation();
        conversation.setId(UUID.randomUUID().toString());
        conversation.setType(ConversationType.GROUP);
        conversation.setGroupId(groupId);
        conversation.setMemberIds(peerId == null ? List.of(userId) : List.of(userId, peerId));
        return ApiResponse.ok(conversations.save(conversation));
    }

    @GetMapping("/{conversationId}")
    public ApiResponse<Conversation> get(@RequestHeader("X-User-Id") String userId,
                                         @PathVariable String conversationId) {
        messages.checkMember(conversationId, userId);
        return ApiResponse.ok(conversations.findById(conversationId)
                .orElseThrow(() -> new BusinessException("Conversation not found")));
    }
}
