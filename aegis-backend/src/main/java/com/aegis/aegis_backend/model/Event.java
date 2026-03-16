package com.aegis.aegis_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String externalId;        // ID from source API (for dedup)

    private String title;
    private String eventType;         // EARTHQUAKE, WILDFIRE, LAUNCH, ASTEROID, SOLAR_FLARE

    private String source;            // USGS, NASA_EONET, LAUNCH_LIBRARY, NEOWS, NOAA

    private Double latitude;
    private Double longitude;

    private String severity;          // LOW, MEDIUM, HIGH, CRITICAL

    @Column(columnDefinition = "TEXT")
    private String description;

    private Double magnitude;         // for earthquakes specifically

    private LocalDateTime eventTime;
    private LocalDateTime fetchedAt;

    private String status;            // ACTIVE, RESOLVED, UPCOMING

    private String sourceUrl;         // link back to original event
}
