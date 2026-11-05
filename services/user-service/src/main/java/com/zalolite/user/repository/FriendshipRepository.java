package com.zalolite.user.repository;

import com.zalolite.user.domain.Friendship;
import com.zalolite.user.domain.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    Optional<Friendship> findByRequesterIdAndRecipientId(String requesterId, String recipientId);
    List<Friendship> findByRecipientIdAndStatus(String recipientId, FriendshipStatus status);
}
