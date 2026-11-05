package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.request.UpdateProfileRequest;
import com.zalolite.user.dto.response.UserProfileResponse;
import com.zalolite.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserServiceImpl implements UserService {
    private final UserRepository users;

    public UserServiceImpl(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserProfileResponse currentUser(String userId) {
        return toResponse(users.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found")));
    }

    @Override
    @Transactional
    public UserProfileResponse update(String userId, UpdateProfileRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));
        if (request.displayName() != null && !request.displayName().isBlank()) {
            user.setDisplayName(request.displayName().trim());
        }
        if (request.avatar() != null) {
            user.setAvatar(request.avatar());
        }
        return toResponse(users.save(user));
    }

    private UserProfileResponse toResponse(User user) {
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getAvatar());
    }
}
