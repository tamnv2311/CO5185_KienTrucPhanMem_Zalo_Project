package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.request.LoginRequest;
import com.zalolite.user.dto.request.RegisterRequest;
import com.zalolite.user.dto.response.AuthResponse;
import com.zalolite.user.dto.response.UserProfileResponse;
import com.zalolite.user.repository.UserRepository;
import com.zalolite.user.repository.RefreshTokenRepository;
import com.zalolite.user.domain.RefreshToken;
import com.zalolite.user.security.TokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.time.Instant;

@Service
public class AuthServiceImpl implements AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenProvider tokens;
    private final RefreshTokenRepository refreshTokens;

    public AuthServiceImpl(UserRepository users, PasswordEncoder passwordEncoder, TokenProvider tokens,
                           RefreshTokenRepository refreshTokens) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
    }

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmail(email)) {
            throw new BusinessException("Email already registered");
        }
        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        users.save(user);
        return tokens(user);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = users.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new BusinessException("Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("Invalid email or password");
        }
        return tokens(user);
    }

    @Override
    public AuthResponse refresh(String refreshToken) {
        String tokenId = tokens.tokenId(refreshToken);
        RefreshToken stored = refreshTokens.findByTokenIdAndRevokedFalse(tokenId)
                .orElseThrow(() -> new BusinessException("Refresh token is invalid"));
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("Refresh token is expired");
        }
        String userId = tokens.userId(refreshToken);
        User user = users.findById(userId)
                .orElseThrow(() -> new BusinessException("Refresh token is invalid"));
        return tokens(user);
    }

    @Override
    @Transactional
    public void logout(String refreshToken) {
        String tokenId = tokens.tokenId(refreshToken);
        refreshTokens.findById(tokenId).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokens.save(token);
        });
    }

    private AuthResponse tokens(User user) {
        UserProfileResponse profile = new UserProfileResponse(
                user.getId(), user.getEmail(), user.getDisplayName(), user.getAvatar());
        String refreshToken = tokens.createRefreshToken(user.getId());
        if (tokens instanceof com.zalolite.user.security.JwtTokenProvider jwtTokens) {
            RefreshToken stored = new RefreshToken();
            stored.setTokenId(jwtTokens.tokenId(refreshToken));
            stored.setUserId(user.getId());
            stored.setExpiresAt(Instant.now().plusSeconds(7 * 24 * 60 * 60));
            refreshTokens.save(stored);
        }
        return new AuthResponse(tokens.createAccessToken(user.getId()), refreshToken, profile);
    }
}
