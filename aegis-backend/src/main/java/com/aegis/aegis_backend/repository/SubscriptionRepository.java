package com.aegis.aegis_backend.repository;

import com.aegis.aegis_backend.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    List<Subscription> findByUserId(Long userId);
    List<Subscription> findByEventType(String eventType);
}
