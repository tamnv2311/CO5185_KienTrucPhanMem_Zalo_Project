package com.zalolite.stats.processor;

import com.zalolite.stats.domain.ProcessedEvent;
import com.zalolite.stats.repository.ProcessedEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdempotencyServiceImpl implements IdempotencyService {
    private final ProcessedEventRepository repository;

    public IdempotencyServiceImpl(ProcessedEventRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public boolean markProcessed(String eventId) {
        if (eventId == null || eventId.isBlank() || repository.existsById(eventId)) {
            return false;
        }
        repository.save(new ProcessedEvent(eventId));
        return true;
    }
}
