package com.zalolite.user.service;

import com.zalolite.common.core.BusinessException;
import com.zalolite.common.events.EventPublisher;
import com.zalolite.user.domain.RefreshToken;
import com.zalolite.user.domain.User;
import com.zalolite.user.dto.Requests;
import com.zalolite.user.dto.Responses;
import com.zalolite.user.repository.RefreshTokenRepository;
import com.zalolite.user.repository.UserRepository;
import com.zalolite.user.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {
    @Mock
    private UserRepository users;
    @Mock
    private RefreshTokenRepository refreshTokens;
    @Mock
    private EventPublisher events;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final JwtTokenProvider tokens = new JwtTokenProvider("zalolite-test-secret-with-at-least-32-bytes");
    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(users, encoder, tokens, refreshTokens, events);
    }

    @Test
    void registerNormalisesEmailAndPublishesEvent() {
        when(users.existsByEmail("lan@example.com")).thenReturn(false);

        Responses.Auth auth = service.register(new Requests.Register(" Lan@Example.com ", "secret123", "Lan", null));

        assertThat(auth.user().email()).isEqualTo("lan@example.com");
        assertThat(tokens.userId(auth.accessToken())).isEqualTo(auth.user().id());
        verify(events).publish(eq("user.registered"), any());
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(users.existsByEmail("lan@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register(new Requests.Register("lan@example.com", "secret123", "Lan", null)))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(409);
        verify(users, never()).save(any());
    }

    @Test
    void loginRejectsWrongPassword() {
        User user = user("user-1", "secret123");
        when(users.findByEmail("lan@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new Requests.Login("lan@example.com", null, "wrong")))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(401);
    }

    @Test
    void loginAcceptsPhoneNumber() {
        User user = user("user-1", "secret123");
        when(users.findByPhone("0912345678")).thenReturn(Optional.of(user));

        Responses.Auth auth = service.login(new Requests.Login("+84 912 345 678", null, "secret123"));

        assertThat(auth.user().id()).isEqualTo("user-1");
    }

    @Test
    void refreshRevokesThePresentedTokenAndIssuesANewPair() {
        String refreshToken = tokens.createRefreshToken("user-1");
        RefreshToken stored = new RefreshToken();
        stored.setTokenId(tokens.tokenId(refreshToken));
        stored.setUserId("user-1");
        stored.setExpiresAt(Instant.now().plusSeconds(60));
        when(refreshTokens.findByTokenIdAndRevokedFalse(stored.getTokenId())).thenReturn(Optional.of(stored));
        when(users.findById("user-1")).thenReturn(Optional.of(user("user-1", "secret123")));

        Responses.Auth auth = service.refresh(refreshToken);

        assertThat(stored.isRevoked()).isTrue();
        assertThat(auth.refreshToken()).isNotEqualTo(refreshToken);
    }

    @Test
    void accessTokenCannotBeUsedAsRefreshToken() {
        String accessToken = tokens.createAccessToken("user-1");

        assertThatThrownBy(() -> service.refresh(accessToken))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(401);
    }

    private User user(String id, String password) {
        User user = new User();
        user.setId(id);
        user.setEmail("lan@example.com");
        user.setDisplayName("Lan");
        user.setPasswordHash(encoder.encode(password));
        return user;
    }
}
