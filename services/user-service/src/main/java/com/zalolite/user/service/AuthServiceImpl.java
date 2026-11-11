package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.common.events.Events;
import com.zalolite.user.domain.RefreshToken;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.repository.RefreshTokenRepository;
import com.zalolite.user.repository.UserRepository;
import com.zalolite.user.security.TokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {
    private static final String BAD_CREDENTIALS = "Email/số điện thoại hoặc mật khẩu không đúng";
    private static final String BAD_REFRESH = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenProvider tokens;
    private final RefreshTokenRepository refreshTokens;
    private final EventPublisher events;

    public AuthServiceImpl(UserRepository users, PasswordEncoder passwordEncoder, TokenProvider tokens,
                           RefreshTokenRepository refreshTokens, EventPublisher events) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.events = events;
    }

    @Override
    @Transactional
    public Responses.Auth register(Requests.Register request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmail(email)) {
            throw BusinessException.conflict("Email đã được đăng ký");
        }
        String phone = Phones.normalize(request.phone());
        if (phone != null && users.existsByPhone(phone)) {
            throw BusinessException.conflict("Số điện thoại đã được đăng ký");
        }
        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        users.save(user);
        events.publish(Events.USER_REGISTERED, Map.of("userId", user.getId(), "displayName", user.getDisplayName()));
        return issueTokens(user);
    }

    @Override
    @Transactional
    public Responses.Auth login(Requests.Login request) {
        String identifier = request.identifier();
        if (identifier == null || identifier.isBlank()) {
            throw new BusinessException(422, "Vui lòng nhập email hoặc số điện thoại");
        }
        Optional<User> found = identifier.contains("@")
                ? users.findByEmail(identifier.trim().toLowerCase())
                : users.findByPhone(Phones.normalize(identifier));
        User user = found.orElseThrow(() -> BusinessException.unauthorized(BAD_CREDENTIALS));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw BusinessException.unauthorized(BAD_CREDENTIALS);
        }
        return issueTokens(user);
    }

    /** Refresh token rotation: the presented token is revoked and a new pair is issued. */
    @Override
    @Transactional
    public Responses.Auth refresh(String refreshToken) {
        RefreshToken stored = findActive(refreshToken)
                .orElseThrow(() -> BusinessException.unauthorized(BAD_REFRESH));
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw BusinessException.unauthorized(BAD_REFRESH);
        }
        User user = users.findById(stored.getUserId())
                .orElseThrow(() -> BusinessException.unauthorized(BAD_REFRESH));
        stored.setRevoked(true);
        refreshTokens.save(stored);
        return issueTokens(user);
    }

    @Override
    @Transactional
    public void logout(String refreshToken) {
        findActive(refreshToken).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokens.save(token);
        });
    }

    @Override
    @Transactional
    public void changePassword(String userId, Requests.ChangePassword request) {
        User user = users.findById(userId).orElseThrow(() -> BusinessException.notFound("Không tìm thấy người dùng"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException("Mật khẩu hiện tại không đúng");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
        // Sign out every other device.
        for (RefreshToken token : refreshTokens.findByUserIdAndRevokedFalse(userId)) {
            token.setRevoked(true);
            refreshTokens.save(token);
        }
    }

    private Optional<RefreshToken> findActive(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return Optional.empty();
        }
        try {
            if (!tokens.isRefreshToken(refreshToken)) {
                return Optional.empty();
            }
            return refreshTokens.findByTokenIdAndRevokedFalse(tokens.tokenId(refreshToken));
        } catch (RuntimeException invalidToken) {
            return Optional.empty();
        }
    }

    private Responses.Auth issueTokens(User user) {
        String refreshToken = tokens.createRefreshToken(user.getId());
        RefreshToken stored = new RefreshToken();
        stored.setTokenId(tokens.tokenId(refreshToken));
        stored.setUserId(user.getId());
        stored.setExpiresAt(Instant.now().plus(tokens.refreshTtl()));
        refreshTokens.save(stored);
        return new Responses.Auth(tokens.createAccessToken(user.getId()), refreshToken,
                tokens.accessTtl().toSeconds(), Responses.Profile.of(user));
    }
}
