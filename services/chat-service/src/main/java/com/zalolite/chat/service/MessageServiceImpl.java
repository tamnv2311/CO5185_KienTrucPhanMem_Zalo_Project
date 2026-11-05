package com.zalolite.chat.service;

import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageStatus;
import com.zalolite.chat.repository.ConversationRepository;
import com.zalolite.chat.repository.MessageRepository;
import com.zalolite.common.core.BusinessException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MessageServiceImpl implements MessageService {
    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final StringRedisTemplate redis;

    public MessageServiceImpl(ConversationRepository conversations, MessageRepository messages,
                              StringRedisTemplate redis) {
        this.conversations = conversations;
        this.messages = messages;
        this.redis = redis;
    }

    @Override
    public Message send(String conversationId, String senderId, String clientMsgId, String content) {
        checkMember(conversationId, senderId);
        var existing = messages.findByConversationIdAndClientMsgId(conversationId, clientMsgId);
        if (existing.isPresent()) {
            return existing.get();
        }

        Message message = new Message();
        message.setConversationId(conversationId);
        message.setSenderId(senderId);
        message.setClientMsgId(clientMsgId);
        message.setContent(content);
        message.setType("TEXT");
        Long seq = redis.opsForValue().increment("chat:seq:" + conversationId);
        message.setSeq(seq == null ? 1 : seq);
        Message saved = messages.save(message);
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new BusinessException("Conversation not found"));
        conversation.setLastMessage(saved);
        conversations.save(conversation);
        return saved;
    }

    @Override
    public List<Message> history(String conversationId, String userId, int limit, Long beforeSeq) {
        checkMember(conversationId, userId);
        int pageSize = Math.max(1, Math.min(limit, 100));
        return messages.findByConversationIdOrderBySeqDesc(conversationId, PageRequest.of(0, pageSize));
    }

    @Override
    public Message markSeen(String messageId, String userId) {
        return updateStatus(messageId, userId, MessageStatus.SEEN);
    }

    @Override
    public Message markDelivered(String messageId, String userId) {
        return updateStatus(messageId, userId, MessageStatus.DELIVERED);
    }

    private Message updateStatus(String messageId, String userId, MessageStatus status) {
        Message message = messages.findById(messageId)
                .orElseThrow(() -> new BusinessException("Message not found"));
        checkMember(message.getConversationId(), userId);
        message.setStatus(status);
        return messages.save(message);
    }

    @Override
    public void checkMember(String conversationId, String userId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new BusinessException("Conversation not found"));
        if (!conversation.getMemberIds().contains(userId)) {
            throw new BusinessException("User is not a conversation member");
        }
    }
}
