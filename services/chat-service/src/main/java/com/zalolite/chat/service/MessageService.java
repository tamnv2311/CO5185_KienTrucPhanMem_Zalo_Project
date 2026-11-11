package com.zalolite.chat.service;

import com.zalolite.chat.dto.ChatDtos.MessageResponse;
import com.zalolite.chat.dto.ChatDtos.ReceiptRequest;
import com.zalolite.chat.dto.ChatDtos.SendMessageRequest;

import java.util.List;
import java.util.Map;

public interface MessageService {
    /** Idempotent on (conversationId, clientMsgId): a retry returns the stored message. */
    MessageResponse send(String senderId, SendMessageRequest request);
    /** Server-generated notice inside a conversation ("An đã thêm Bình vào nhóm"). */
    void sendSystem(String conversationId, String content, Map<String, Object> meta);

    /** One page in chronological order. beforeSeq pages backwards, afterSeq catches up after a reconnect. */
    List<MessageResponse> history(String userId, String conversationId, int limit, Long beforeSeq, Long afterSeq);
    List<MessageResponse> search(String userId, String conversationId, String keyword);
    List<MessageResponse> pinned(String userId, String conversationId);

    MessageResponse recall(String userId, String messageId);
    void deleteForMe(String userId, String messageId);
    /** Toggles the user's reaction with this emoji. */
    MessageResponse react(String userId, String messageId, String emoji);
    List<MessageResponse> forward(String userId, String messageId, List<String> conversationIds);
    MessageResponse pin(String userId, String messageId, boolean pinned);

    MessageResponse markSeen(String userId, String messageId);
    MessageResponse markDelivered(String userId, String messageId);
    void receipt(String userId, ReceiptRequest request, boolean seen);
}
