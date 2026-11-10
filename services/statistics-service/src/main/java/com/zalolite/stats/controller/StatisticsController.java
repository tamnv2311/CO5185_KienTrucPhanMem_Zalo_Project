package com.zalolite.stats.controller;

import com.zalolite.stats.domain.DailyGroupActivity;
import com.zalolite.stats.domain.DailyMediaStats;
import com.zalolite.stats.domain.DailySystemStats;
import com.zalolite.stats.repository.GroupActivityRepository;
import com.zalolite.stats.repository.MediaStatsRepository;
import com.zalolite.stats.repository.StatsRepositories;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stats")
public class StatisticsController {
    private final StatsRepositories systemRepository;
    private final GroupActivityRepository groupRepository;
    private final MediaStatsRepository mediaRepository;

    public StatisticsController(StatsRepositories systemRepository, GroupActivityRepository groupRepository,
                                MediaStatsRepository mediaRepository) {
        this.systemRepository = systemRepository;
        this.groupRepository = groupRepository;
        this.mediaRepository = mediaRepository;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        DailySystemStats stats = systemRepository.findByDate(LocalDate.now()).orElseGet(() -> new DailySystemStats(LocalDate.now()));
        return Map.of("date", stats.getDate().toString(), "totalMessages", stats.getTotalMessages(),
                "activeUsers", stats.getActiveUsers(), "newUsers", stats.getNewUsers(), "totalMedia", stats.getTotalMedia());
    }

    @GetMapping("/groups")
    public List<DailyGroupActivity> groups() { return groupRepository.findTop10ByOrderByMessageCountDesc(); }

    @GetMapping("/media")
    public List<DailyMediaStats> media() {
        return mediaRepository.findByDate(LocalDate.now());
    }

    @GetMapping("/history")
    public List<DailySystemStats> history() { return systemRepository.findAll(); }
}
