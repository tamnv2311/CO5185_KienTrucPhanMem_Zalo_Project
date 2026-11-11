package com.zalolite.stats.repository;

import com.zalolite.stats.domain.KnownUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnownUserRepository extends JpaRepository<KnownUser, String> {
}
