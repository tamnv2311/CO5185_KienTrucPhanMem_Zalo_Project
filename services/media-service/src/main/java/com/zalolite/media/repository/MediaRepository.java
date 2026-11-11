package com.zalolite.media.repository;

import com.zalolite.media.domain.Media;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MediaRepository extends MongoRepository<Media, String> {
}
