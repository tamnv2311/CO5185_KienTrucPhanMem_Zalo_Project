package com.zalolite.stats.repository;

import com.zalolite.stats.domain.DailyGroupActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GroupActivityRepository extends JpaRepository<DailyGroupActivity, Long> {
    Optional<DailyGroupActivity> findByDateAndGroupId(LocalDate date, String groupId);
    List<DailyGroupActivity> findTop10ByOrderByMessageCountDesc();
}
