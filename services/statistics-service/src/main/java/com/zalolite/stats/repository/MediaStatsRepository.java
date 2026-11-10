package com.zalolite.stats.repository;

import com.zalolite.stats.domain.DailyMediaStats;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MediaStatsRepository extends JpaRepository<DailyMediaStats, Long> {
    Optional<DailyMediaStats> findByDateAndMediaKind(LocalDate date, String mediaKind);
    List<DailyMediaStats> findByDate(LocalDate date);
}
