package com.zalolite.chat.service;

import com.zalolite.chat.domain.Message;
import com.zalolite.chat.domain.MessageStatus;

import java.util.List;

public interface MessageService {
    Message send(String conversationId, String senderId, String clientMsgId, String content);
    List<Message> history(String conversationId, String userId, int limit, Long beforeSeq);
    Message markSeen(String messageId, String userId);
    Message markDelivered(String messageId, String userId);
    void checkMember(String conversationId, String userId);
}
