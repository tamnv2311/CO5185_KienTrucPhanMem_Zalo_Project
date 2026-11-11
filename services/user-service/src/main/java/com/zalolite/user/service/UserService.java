package com.zalolite.user.service;

import com.zalolite.user.domain.User;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserService {
    Responses.Profile currentUser(String userId);
    Responses.Profile update(String userId, Requests.UpdateProfile request);
    Responses.PublicUser publicProfile(String viewerId, String userId);
    /** Exact e-mail / phone match first, otherwise users whose display name contains the keyword. */
    List<Responses.PublicUser> search(String viewerId, String keyword);
    /** Resolves a user by id, e-mail or phone. */
    Optional<User> resolve(String idEmailOrPhone);
    Responses.PublicUser toPublic(String viewerId, User user);
    List<Responses.PublicUser> byIds(Collection<String> ids);
}
