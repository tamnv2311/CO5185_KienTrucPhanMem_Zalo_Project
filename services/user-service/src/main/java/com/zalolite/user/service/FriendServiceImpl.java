package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.user.domain.Friendship;
import com.zalolite.user.domain.FriendshipStatus;
import com.zalolite.user.repository.FriendshipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FriendServiceImpl implements FriendService {
    private final FriendshipRepository friendships;

    public FriendServiceImpl(FriendshipRepository friendships) {
        this.friendships = friendships;
    }

    @Override
    @Transactional
    public Friendship request(String requesterId, String recipientId) {
        if (requesterId.equals(recipientId)) {
            throw new BusinessException("Cannot add yourself as a friend");
        }
        Friendship friendship = friendships.findByRequesterIdAndRecipientId(requesterId, recipientId)
                .orElse(new Friendship());
        friendship.setRequesterId(requesterId);
        friendship.setRecipientId(recipientId);
        friendship.setStatus(FriendshipStatus.PENDING);
        return friendships.save(friendship);
    }

    @Override
    @Transactional
    public Friendship accept(String recipientId, Long friendshipId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> new BusinessException("Friend request not found"));
        if (!recipientId.equals(friendship.getRecipientId())) {
            throw new BusinessException("Cannot accept another user's request");
        }
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        return friendships.save(friendship);
    }

    @Override
    public List<Friendship> pending(String userId) {
        return friendships.findByRecipientIdAndStatus(userId, FriendshipStatus.PENDING);
    }

    @Override
    public List<Friendship> friends(String userId) {
        return friendships.findAll().stream()
                .filter(friendship -> friendship.getStatus() == FriendshipStatus.ACCEPTED &&
                        (userId.equals(friendship.getRequesterId()) || userId.equals(friendship.getRecipientId())))
                .toList();
    }

    @Override
    @Transactional
    public void reject(String recipientId, Long friendshipId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> new BusinessException("Friend request not found"));
        if (!recipientId.equals(friendship.getRecipientId())) {
            throw new BusinessException("Cannot reject another user's request");
        }
        friendships.delete(friendship);
    }

    @Override
    @Transactional
    public void cancel(String requesterId, Long friendshipId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> new BusinessException("Friend request not found"));
        if (!requesterId.equals(friendship.getRequesterId())) {
            throw new BusinessException("Cannot cancel another user's request");
        }
        friendships.delete(friendship);
    }
}
