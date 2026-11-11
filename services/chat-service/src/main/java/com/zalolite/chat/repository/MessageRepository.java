package com.zalolite.chat.repository;

import com.zalolite.chat.domain.Message;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface MessageRepository extends MongoRepository<Message, String> {
    Optional<Message> findByConversationIdAndClientMsgId(String conversationId, String clientMsgId);
    Optional<Message> findFirstByConversationIdOrderBySeqDesc(String conversationId);
    void deleteByConversationId(String conversationId);
}
