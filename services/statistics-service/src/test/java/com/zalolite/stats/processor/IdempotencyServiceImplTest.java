package com.zalolite.stats.processor;

import com.zalolite.stats.repository.ProcessedEventRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IdempotencyServiceImplTest {
    @Test
    void processesEachEventOnlyOnce() {
        ProcessedEventRepository repository = mock(ProcessedEventRepository.class);
        IdempotencyServiceImpl service = new IdempotencyServiceImpl(repository);
        when(repository.existsById("event-1")).thenReturn(false, true);

        assertTrue(service.markProcessed("event-1"));
        assertFalse(service.markProcessed("event-1"));
    }

    @Test
    void rejectsBlankEventId() {
        IdempotencyServiceImpl service = new IdempotencyServiceImpl(mock(ProcessedEventRepository.class));
        assertFalse(service.markProcessed(" "));
    }
}
