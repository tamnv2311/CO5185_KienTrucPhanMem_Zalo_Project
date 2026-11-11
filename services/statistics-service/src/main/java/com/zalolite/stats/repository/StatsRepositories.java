package com.zalolite.stats.repository;

import com.zalolite.stats.domain.DailySystemStats;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface StatsRepositories extends JpaRepository<DailySystemStats, Long> {
    Optional<DailySystemStats> findByDate(LocalDate date);

    java.util.List<DailySystemStats> findByDateGreaterThanEqualOrderByDateAsc(LocalDate from);
}
