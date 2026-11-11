package com.zalolite.stats.repository;

import com.zalolite.stats.domain.DailyGroupActivity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GroupActivityRepository extends JpaRepository<DailyGroupActivity, Long> {
    Optional<DailyGroupActivity> findByDateAndGroupId(LocalDate date, String groupId);

    /** Rows of [groupId, groupName, total messages], busiest group first. */
    @Query("select g.groupId, max(g.groupName), sum(g.messageCount) from DailyGroupActivity g "
            + "group by g.groupId order by sum(g.messageCount) desc")
    List<Object[]> totalsByGroup(Pageable pageable);
}
