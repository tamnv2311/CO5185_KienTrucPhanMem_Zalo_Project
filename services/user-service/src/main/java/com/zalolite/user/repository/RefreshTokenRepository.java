package com.zalolite.user.repository;

import com.zalolite.user.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    Optional<RefreshToken> findByTokenIdAndRevokedFalse(String tokenId);
}
