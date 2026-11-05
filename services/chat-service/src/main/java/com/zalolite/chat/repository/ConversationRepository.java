package com.zalolite.chat.repository;

import com.zalolite.chat.domain.Conversation;
import com.zalolite.chat.domain.ConversationType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    Optional<Conversation> findByTypeAndMemberIdsContaining(ConversationType type, String memberId);
}
