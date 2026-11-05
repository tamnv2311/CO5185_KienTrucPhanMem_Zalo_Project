package com.zalolite.user.service;

import com.zalolite.user.dto.request.UpdateProfileRequest;
import com.zalolite.user.dto.response.UserProfileResponse;

public interface UserService {
    UserProfileResponse currentUser(String userId);
    UserProfileResponse update(String userId, UpdateProfileRequest request);
}
