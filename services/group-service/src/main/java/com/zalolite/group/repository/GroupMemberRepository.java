package com.zalolite.group.repository;

import com.zalolite.group.domain.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    Optional<GroupMember> findByGroupIdAndUserId(String groupId, String userId);
    List<GroupMember> findByGroupId(String groupId);
}
