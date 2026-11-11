package com.zalolite.user.repository;

import com.zalolite.user.domain.Friendship;
import com.zalolite.user.domain.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    /** Rows between two users, whichever of them sent the request. */
    @Query("select f from Friendship f where (f.requesterId = :a and f.recipientId = :b) "
            + "or (f.requesterId = :b and f.recipientId = :a)")
    List<Friendship> findBetween(@Param("a") String a, @Param("b") String b);

    @Query("select f from Friendship f where f.status = :status "
            + "and (f.requesterId = :userId or f.recipientId = :userId) order by f.updatedAt desc")
    List<Friendship> findInvolving(@Param("userId") String userId, @Param("status") FriendshipStatus status);

    List<Friendship> findByRecipientIdAndStatusOrderByCreatedAtDesc(String recipientId, FriendshipStatus status);

    List<Friendship> findByRequesterIdAndStatusOrderByCreatedAtDesc(String requesterId, FriendshipStatus status);
}
