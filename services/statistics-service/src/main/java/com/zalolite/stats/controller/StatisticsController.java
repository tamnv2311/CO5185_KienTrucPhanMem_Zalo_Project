package com.zalolite.stats.controller;

import com.zalolite.stats.domain.DailyMediaStats;
import com.zalolite.stats.domain.DailySystemStats;
import com.zalolite.stats.domain.KnownUser;
import com.zalolite.stats.repository.GroupActivityRepository;
import com.zalolite.stats.repository.KnownUserRepository;
import com.zalolite.stats.repository.MediaStatsRepository;
import com.zalolite.stats.repository.StatsRepositories;
import com.zalolite.stats.repository.UserActivityRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read side of the statistics CQRS: the dashboard only reads pre-aggregated tables. */
@RestController
@RequestMapping("/api/stats")
public class StatisticsController {
    private final StatsRepositories systemRepository;
    private final GroupActivityRepository groupRepository;
    private final MediaStatsRepository mediaRepository;
    private final UserActivityRepository userRepository;
    private final KnownUserRepository knownUsers;

    public StatisticsController(StatsRepositories systemRepository, GroupActivityRepository groupRepository,
                                MediaStatsRepository mediaRepository, UserActivityRepository userRepository,
                                KnownUserRepository knownUsers) {
        this.systemRepository = systemRepository;
        this.groupRepository = groupRepository;
        this.mediaRepository = mediaRepository;
        this.userRepository = userRepository;
        this.knownUsers = knownUsers;
    }

    /** Today's numbers plus all-time totals. */
    @GetMapping("/overview")
    public Map<String, Object> overview() {
        LocalDate today = LocalDate.now();
        DailySystemStats stats = systemRepository.findByDate(today).orElseGet(() -> new DailySystemStats(today));
        List<DailySystemStats> all = systemRepository.findAll();
        Map<String, Object> result = day(stats);
        result.put("allTimeMessages", all.stream().mapToLong(DailySystemStats::getTotalMessages).sum());
        result.put("allTimeMedia", all.stream().mapToLong(DailySystemStats::getTotalMedia).sum());
        result.put("registeredUsers", knownUsers.count());
        return result;
    }

    /** One entry per day for the last N days (days without activity are zero-filled). */
    @GetMapping("/history")
    public List<Map<String, Object>> history(@RequestParam(defaultValue = "7") int days) {
        int span = Math.max(1, Math.min(days, 90));
        LocalDate from = LocalDate.now().minusDays(span - 1L);
        Map<LocalDate, DailySystemStats> byDate = systemRepository.findByDateGreaterThanEqualOrderByDateAsc(from)
                .stream().collect(Collectors.toMap(DailySystemStats::getDate, Function.identity(), (a, b) -> a));
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < span; i++) {
            LocalDate date = from.plusDays(i);
            result.add(day(byDate.getOrDefault(date, new DailySystemStats(date))));
        }
        return result;
    }

    /** Most active groups. */
    @GetMapping("/groups")
    public List<Map<String, Object>> groups(@RequestParam(defaultValue = "10") int limit) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : groupRepository.totalsByGroup(page(limit))) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("groupId", row[0]);
            item.put("groupName", row[1] == null ? row[0] : row[1]);
            item.put("messageCount", row[2]);
            result.add(item);
        }
        return result;
    }

    /** Most active users. */
    @GetMapping("/users")
    public List<Map<String, Object>> users(@RequestParam(defaultValue = "10") int limit) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : userRepository.totalsByUser(page(limit))) {
            String userId = String.valueOf(row[0]);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", userId);
            item.put("displayName", knownUsers.findById(userId).map(KnownUser::getDisplayName).orElse(userId));
            item.put("messageCount", row[1]);
            result.add(item);
        }
        return result;
    }

    /** Uploaded files per kind (IMAGE / VIDEO / FILE), all time. */
    @GetMapping("/media")
    public List<Map<String, Object>> media() {
        Map<String, Long> totals = new LinkedHashMap<>();
        for (DailyMediaStats row : mediaRepository.findAll()) {
            totals.merge(row.getMediaKind(), row.getCount(), Long::sum);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        totals.forEach((kind, count) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("mediaKind", kind);
            item.put("count", count);
            result.add(item);
        });
        return result;
    }

    private static PageRequest page(int limit) {
        return PageRequest.of(0, Math.max(1, Math.min(limit, 50)));
    }

    private static Map<String, Object> day(DailySystemStats stats) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", stats.getDate().toString());
        result.put("totalMessages", stats.getTotalMessages());
        result.put("activeUsers", stats.getActiveUsers());
        result.put("newUsers", stats.getNewUsers());
        result.put("totalMedia", stats.getTotalMedia());
        return result;
    }
}
