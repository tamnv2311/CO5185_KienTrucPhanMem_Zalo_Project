package com.zalolite.user.repository;

import com.zalolite.user.domain.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);

    @Query("select u from User u where lower(u.displayName) like lower(concat('%', :keyword, '%')) order by u.displayName")
    List<User> searchByName(@Param("keyword") String keyword, Pageable pageable);
}
