package com.aegis.aegis_backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "subscriptions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String eventType;         // EARTHQUAKE, WILDFIRE etc.
    private String region;            // e.g. "Asia", "North America", or "ALL"
    private String minSeverity;       // LOW / MEDIUM / HIGH / CRITICAL
}
