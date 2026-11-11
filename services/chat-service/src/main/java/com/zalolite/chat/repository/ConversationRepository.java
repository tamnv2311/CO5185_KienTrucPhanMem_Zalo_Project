package com.zalolite.chat.repository;

import com.zalolite.chat.domain.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByMemberIdsContainingOrderByUpdatedAtDesc(String memberId);
}
