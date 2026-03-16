package com.aegis.aegis_backend.repository;

import com.aegis.aegis_backend.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {
    Optional<Event> findByExternalId(String externalId);           // dedup check
    List<Event> findByEventType(String eventType);
    List<Event> findBySeverity(String severity);
    List<Event> findByStatus(String status);
    List<Event> findByEventTypeAndSeverity(String eventType, String severity);
}
