package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.common.events.Events;
import com.zalolite.user.domain.Friendship;
import com.zalolite.user.domain.FriendshipStatus;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.repository.FriendshipRepository;
import com.zalolite.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FriendServiceImpl implements FriendService {
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final UserService userService;
    private final EventPublisher events;

    public FriendServiceImpl(FriendshipRepository friendships, UserRepository users, UserService userService,
                             EventPublisher events) {
        this.friendships = friendships;
        this.users = users;
        this.userService = userService;
        this.events = events;
    }

    @Override
    @Transactional
    public Responses.Friend request(String requesterId, Requests.FriendRequest request) {
        User target = userService.resolve(request.anyTarget())
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy người dùng"));
        if (requesterId.equals(target.getId())) {
            throw new BusinessException("Không thể kết bạn với chính mình");
        }
        for (Friendship existing : friendships.findBetween(requesterId, target.getId())) {
            switch (existing.getStatus()) {
                case ACCEPTED -> throw BusinessException.conflict("Hai bạn đã là bạn bè");
                case BLOCKED -> throw BusinessException.forbidden("Không thể gửi lời mời kết bạn tới người dùng này");
                case PENDING -> {
                    if (requesterId.equals(existing.getRequesterId())) {
                        return toResponse(requesterId, existing);
                    }
                    // The other side already invited us: sending a request back means "yes".
                    return accept(requesterId, existing.getId());
                }
            }
        }
        Friendship friendship = new Friendship();
        friendship.setRequesterId(requesterId);
        friendship.setRecipientId(target.getId());
        friendship.setStatus(FriendshipStatus.PENDING);
        friendship.setMessage(request.message() == null || request.message().isBlank() ? null : request.message().trim());
        friendships.save(friendship);
        publish(Events.FRIEND_REQUESTED, friendship);
        return toResponse(requesterId, friendship);
    }

    @Override
    @Transactional
    public Responses.Friend accept(String recipientId, Long friendshipId) {
        Friendship friendship = pending(friendshipId);
        if (!recipientId.equals(friendship.getRecipientId())) {
            throw BusinessException.forbidden("Bạn không thể chấp nhận lời mời này");
        }
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendships.save(friendship);
        publish(Events.FRIEND_ACCEPTED, friendship);
        return toResponse(recipientId, friendship);
    }

    @Override
    @Transactional
    public void reject(String recipientId, Long friendshipId) {
        Friendship friendship = pending(friendshipId);
        if (!recipientId.equals(friendship.getRecipientId())) {
            throw BusinessException.forbidden("Bạn không thể từ chối lời mời này");
        }
        friendships.delete(friendship);
    }

    @Override
    @Transactional
    public void cancel(String requesterId, Long friendshipId) {
        Friendship friendship = pending(friendshipId);
        if (!requesterId.equals(friendship.getRequesterId())) {
            throw BusinessException.forbidden("Bạn không thể thu hồi lời mời này");
        }
        friendships.delete(friendship);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Responses.Friend> friends(String userId) {
        return toResponses(userId, friendships.findInvolving(userId, FriendshipStatus.ACCEPTED));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Responses.Friend> incoming(String userId) {
        return toResponses(userId, friendships.findByRecipientIdAndStatusOrderByCreatedAtDesc(userId, FriendshipStatus.PENDING));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Responses.Friend> outgoing(String userId) {
        return toResponses(userId, friendships.findByRequesterIdAndStatusOrderByCreatedAtDesc(userId, FriendshipStatus.PENDING));
    }

    @Override
    @Transactional
    public void unfriend(String userId, String friendId) {
        Friendship friendship = friendships.findBetween(userId, friendId).stream()
                .filter(candidate -> candidate.getStatus() == FriendshipStatus.ACCEPTED)
                .findFirst()
                .orElseThrow(() -> BusinessException.notFound("Hai bạn chưa là bạn bè"));
        friendships.delete(friendship);
        publish(Events.FRIEND_REMOVED, friendship);
    }

    @Override
    @Transactional
    public void block(String userId, String targetId) {
        if (userId.equals(targetId)) {
            throw new BusinessException("Không thể chặn chính mình");
        }
        if (!users.existsById(targetId)) {
            throw BusinessException.notFound("Không tìm thấy người dùng");
        }
        for (Friendship existing : friendships.findBetween(userId, targetId)) {
            if (existing.getStatus() == FriendshipStatus.BLOCKED && userId.equals(existing.getRequesterId())) {
                return;
            }
            if (existing.getStatus() == FriendshipStatus.BLOCKED) {
                continue; // the other side blocked us; keep their row, add ours below
            }
            friendships.delete(existing);
            if (existing.getStatus() == FriendshipStatus.ACCEPTED) {
                publish(Events.FRIEND_REMOVED, existing);
            }
        }
        friendships.flush();
        Friendship block = new Friendship();
        block.setRequesterId(userId);
        block.setRecipientId(targetId);
        block.setStatus(FriendshipStatus.BLOCKED);
        friendships.save(block);
    }

    @Override
    @Transactional
    public void unblock(String userId, String targetId) {
        friendships.findBetween(userId, targetId).stream()
                .filter(existing -> existing.getStatus() == FriendshipStatus.BLOCKED
                        && userId.equals(existing.getRequesterId()))
                .forEach(friendships::delete);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Responses.Friend> blocked(String userId) {
        return toResponses(userId, friendships.findByRequesterIdAndStatusOrderByCreatedAtDesc(userId, FriendshipStatus.BLOCKED));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean areFriends(String a, String b) {
        return friendships.findBetween(a, b).stream()
                .anyMatch(friendship -> friendship.getStatus() == FriendshipStatus.ACCEPTED);
    }

    private Friendship pending(Long friendshipId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy lời mời kết bạn"));
        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw BusinessException.conflict("Lời mời kết bạn đã được xử lý");
        }
        return friendship;
    }

    private void publish(String type, Friendship friendship) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("friendshipId", friendship.getId());
        payload.put("requesterId", friendship.getRequesterId());
        payload.put("recipientId", friendship.getRecipientId());
        payload.put("requesterName", name(friendship.getRequesterId()));
        payload.put("recipientName", name(friendship.getRecipientId()));
        if (friendship.getMessage() != null) {
            payload.put("message", friendship.getMessage());
        }
        events.publish(type, payload);
    }

    private String name(String userId) {
        return users.findById(userId).map(User::getDisplayName).orElse("Người dùng");
    }

    private List<Responses.Friend> toResponses(String viewerId, List<Friendship> rows) {
        List<Responses.Friend> result = new ArrayList<>();
        for (Friendship row : rows) {
            Responses.Friend response = toResponse(viewerId, row);
            if (response.user() != null) {
                result.add(response);
            }
        }
        return result;
    }

    private Responses.Friend toResponse(String viewerId, Friendship friendship) {
        Responses.PublicUser other = users.findById(friendship.otherThan(viewerId))
                .map(user -> Responses.PublicUser.of(user, relation(viewerId, friendship), friendship.getId()))
                .orElse(null);
        return new Responses.Friend(friendship.getId(), friendship.getStatus().name(), friendship.getMessage(),
                friendship.getCreatedAt(), friendship.getUpdatedAt(), friendship.getRequesterId(),
                friendship.getRecipientId(), other);
    }

    private static String relation(String viewerId, Friendship friendship) {
        boolean mine = viewerId.equals(friendship.getRequesterId());
        return switch (friendship.getStatus()) {
            case ACCEPTED -> "FRIEND";
            case PENDING -> mine ? "REQUEST_SENT" : "REQUEST_RECEIVED";
            case BLOCKED -> mine ? "BLOCKED" : "BLOCKED_BY";
        };
    }
}
