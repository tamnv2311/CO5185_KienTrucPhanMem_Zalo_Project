package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.user.domain.Friendship;
import com.zalolite.user.domain.FriendshipStatus;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.repository.FriendshipRepository;
import com.zalolite.user.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class UserServiceImpl implements UserService {
    private static final Set<String> GENDERS = Set.of("male", "female", "other");

    private final UserRepository users;
    private final FriendshipRepository friendships;

    public UserServiceImpl(UserRepository users, FriendshipRepository friendships) {
        this.users = users;
        this.friendships = friendships;
    }

    @Override
    @Transactional(readOnly = true)
    public Responses.Profile currentUser(String userId) {
        return Responses.Profile.of(require(userId));
    }

    @Override
    @Transactional
    public Responses.Profile update(String userId, Requests.UpdateProfile request) {
        User user = require(userId);
        if (request.displayName() != null && !request.displayName().isBlank()) {
            user.setDisplayName(request.displayName().trim());
        }
        if (request.avatar() != null) {
            user.setAvatar(blankToNull(request.avatar()));
        }
        if (request.cover() != null) {
            user.setCover(blankToNull(request.cover()));
        }
        if (request.bio() != null) {
            user.setBio(blankToNull(request.bio()));
        }
        if (request.birthday() != null) {
            user.setBirthday(blankToNull(request.birthday()));
        }
        if (request.gender() != null) {
            String gender = request.gender().trim().toLowerCase();
            user.setGender(GENDERS.contains(gender) ? gender : null);
        }
        if (request.phone() != null) {
            String phone = Phones.normalize(request.phone());
            if (phone != null && !phone.equals(user.getPhone()) && users.existsByPhone(phone)) {
                throw BusinessException.conflict("Số điện thoại đã được sử dụng");
            }
            user.setPhone(phone);
        }
        return Responses.Profile.of(users.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public Responses.PublicUser publicProfile(String viewerId, String userId) {
        return toPublic(viewerId, require(userId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Responses.PublicUser> search(String viewerId, String keyword) {
        String term = keyword == null ? "" : keyword.trim();
        if (term.isEmpty()) {
            return List.of();
        }
        Map<String, User> found = new LinkedHashMap<>();
        if (term.contains("@")) {
            users.findByEmail(term.toLowerCase()).ifPresent(user -> found.put(user.getId(), user));
        } else if (Phones.looksLikePhone(term)) {
            users.findByPhone(Phones.normalize(term)).ifPresent(user -> found.put(user.getId(), user));
        }
        if (found.isEmpty() && term.length() >= 2) {
            users.searchByName(term, PageRequest.of(0, 20)).forEach(user -> found.put(user.getId(), user));
        }
        found.remove(viewerId);
        List<Responses.PublicUser> result = new ArrayList<>();
        for (User user : found.values()) {
            Responses.PublicUser candidate = toPublic(viewerId, user);
            // People who blocked the viewer stay invisible.
            if (!"BLOCKED_BY".equals(candidate.relation())) {
                result.add(candidate);
            }
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<User> resolve(String idEmailOrPhone) {
        if (idEmailOrPhone == null || idEmailOrPhone.isBlank()) {
            return Optional.empty();
        }
        String value = idEmailOrPhone.trim();
        if (value.contains("@")) {
            return users.findByEmail(value.toLowerCase());
        }
        Optional<User> byId = users.findById(value);
        if (byId.isPresent() || !Phones.looksLikePhone(value)) {
            return byId;
        }
        return users.findByPhone(Phones.normalize(value));
    }

    @Override
    public Responses.PublicUser toPublic(String viewerId, User user) {
        if (viewerId == null) {
            return Responses.PublicUser.of(user, "NONE", null);
        }
        if (viewerId.equals(user.getId())) {
            return Responses.PublicUser.of(user, "SELF", null);
        }
        String relation = "NONE";
        Long friendshipId = null;
        for (Friendship friendship : friendships.findBetween(viewerId, user.getId())) {
            friendshipId = friendship.getId();
            boolean mine = viewerId.equals(friendship.getRequesterId());
            if (friendship.getStatus() == FriendshipStatus.ACCEPTED) {
                relation = "FRIEND";
            } else if (friendship.getStatus() == FriendshipStatus.PENDING) {
                relation = mine ? "REQUEST_SENT" : "REQUEST_RECEIVED";
            } else {
                relation = mine ? "BLOCKED" : "BLOCKED_BY";
            }
        }
        return Responses.PublicUser.of(user, relation, friendshipId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Responses.PublicUser> byIds(Collection<String> ids) {
        return users.findAllById(ids).stream().map(user -> Responses.PublicUser.of(user, "NONE", null)).toList();
    }

    private User require(String userId) {
        return users.findById(userId).orElseThrow(() -> BusinessException.notFound("Không tìm thấy người dùng"));
    }

    private static String blankToNull(String value) {
        return value.isBlank() ? null : value.trim();
    }
}
