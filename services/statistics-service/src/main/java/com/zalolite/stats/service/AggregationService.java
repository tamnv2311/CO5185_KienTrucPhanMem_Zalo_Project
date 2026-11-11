package com.zalolite.stats.service;

import com.zalolite.stats.domain.DailyGroupActivity;
import com.zalolite.stats.domain.DailyMediaStats;
import com.zalolite.stats.domain.DailySystemStats;
import com.zalolite.stats.domain.DailyUserActivity;
import com.zalolite.stats.domain.KnownUser;
import com.zalolite.stats.repository.GroupActivityRepository;
import com.zalolite.stats.repository.KnownUserRepository;
import com.zalolite.stats.repository.MediaStatsRepository;
import com.zalolite.stats.repository.StatsRepositories;
import com.zalolite.stats.repository.UserActivityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/** Write side of the statistics CQRS: turns events into per-day counters. */
@Service
public class AggregationService {
    private final StatsRepositories systemRepository;
    private final GroupActivityRepository groupRepository;
    private final MediaStatsRepository mediaRepository;
    private final UserActivityRepository userRepository;
    private final KnownUserRepository knownUsers;

    public AggregationService(StatsRepositories systemRepository, GroupActivityRepository groupRepository,
                              MediaStatsRepository mediaRepository, UserActivityRepository userRepository,
                              KnownUserRepository knownUsers) {
        this.systemRepository = systemRepository;
        this.groupRepository = groupRepository;
        this.mediaRepository = mediaRepository;
        this.userRepository = userRepository;
        this.knownUsers = knownUsers;
    }

    @Transactional
    public void recordMessage(String senderId, String groupId, String groupName) {
        LocalDate today = LocalDate.now();
        if (senderId != null && !senderId.isBlank()) {
            DailyUserActivity user = userRepository.findByDateAndUserId(today, senderId)
                    .orElseGet(() -> new DailyUserActivity(today, senderId));
            user.addMessage();
            userRepository.saveAndFlush(user);
        }
        DailySystemStats system = todaySystem();
        system.addMessage();
        system.setActiveUsers(userRepository.countByDate(today));
        systemRepository.save(system);
        if (groupId != null && !groupId.isBlank()) {
            DailyGroupActivity group = groupRepository.findByDateAndGroupId(today, groupId)
                    .orElseGet(() -> new DailyGroupActivity(today, groupId));
            group.addMessage();
            if (groupName != null) {
                group.setGroupName(groupName);
            }
            groupRepository.save(group);
        }
    }

    @Transactional
    public void recordUserRegistered(String userId, String displayName) {
        DailySystemStats system = todaySystem();
        system.addNewUser();
        systemRepository.save(system);
        if (userId != null && !userId.isBlank()) {
            knownUsers.save(new KnownUser(userId, displayName));
        }
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
