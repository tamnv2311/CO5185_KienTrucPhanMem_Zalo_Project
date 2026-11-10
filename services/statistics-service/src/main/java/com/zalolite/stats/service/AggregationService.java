package com.zalolite.stats.service;

import com.zalolite.stats.domain.DailyGroupActivity;
import com.zalolite.stats.domain.DailyMediaStats;
import com.zalolite.stats.domain.DailySystemStats;
import com.zalolite.stats.repository.GroupActivityRepository;
import com.zalolite.stats.repository.MediaStatsRepository;
import com.zalolite.stats.repository.StatsRepositories;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;

@Service
public class AggregationService {
    private final StatsRepositories systemRepository;
    private final GroupActivityRepository groupRepository;
    private final MediaStatsRepository mediaRepository;

    public AggregationService(StatsRepositories systemRepository, GroupActivityRepository groupRepository,
                              MediaStatsRepository mediaRepository) {
        this.systemRepository = systemRepository;
        this.groupRepository = groupRepository;
        this.mediaRepository = mediaRepository;
    }

    @Transactional
    public void recordMessage(String groupId) {
        DailySystemStats system = todaySystem();
        system.addMessage();
        systemRepository.save(system);
        if (groupId != null && !groupId.isBlank()) {
            DailyGroupActivity group = groupRepository.findByDateAndGroupId(LocalDate.now(), groupId)
                    .orElseGet(() -> new DailyGroupActivity(LocalDate.now(), groupId));
            group.addMessage();
            groupRepository.save(group);
        }
    }

    @Transactional
    public void recordUserRegistered() {
        todaySystem().addNewUser();
        systemRepository.save(todaySystem());
    }

    @Transactional
    public void recordMedia(String kind) {
        DailySystemStats system = todaySystem();
        system.addMedia();
        systemRepository.save(system);
        LocalDate today = LocalDate.now();
        DailyMediaStats media = mediaRepository.findByDateAndMediaKind(today, kind)
                .orElseGet(() -> new DailyMediaStats(today, kind));
        media.increment();
        mediaRepository.save(media);
    }

    private DailySystemStats todaySystem() {
        return systemRepository.findByDate(LocalDate.now()).orElseGet(() -> new DailySystemStats(LocalDate.now()));
    }
}
