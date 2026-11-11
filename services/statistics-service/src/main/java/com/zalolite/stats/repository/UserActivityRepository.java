package com.zalolite.stats.repository;

import com.zalolite.stats.domain.DailyUserActivity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface UserActivityRepository extends JpaRepository<DailyUserActivity, Long> {
    Optional<DailyUserActivity> findByDateAndUserId(LocalDate date, String userId);

    long countByDate(LocalDate date);

    /** Rows of [userId, total messages], most active user first. */
    @Query("select u.userId, sum(u.messageCount) from DailyUserActivity u "
            + "group by u.userId order by sum(u.messageCount) desc")
    List<Object[]> totalsByUser(Pageable pageable);
}
