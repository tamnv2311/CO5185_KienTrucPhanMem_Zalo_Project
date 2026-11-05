package com.zalolite.chat.repository;

import com.zalolite.chat.domain.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface MessageRepository extends MongoRepository<Message, String> {
    Optional<Message> findByConversationIdAndClientMsgId(String conversationId, String clientMsgId);
    List<Message> findByConversationIdOrderBySeqDesc(String conversationId, Pageable pageable);
    List<Message> findByConversationIdAndSeqLessThanOrderBySeqDesc(
            String conversationId, long seq, Pageable pageable);
}
