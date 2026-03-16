package com.aegis.aegis_backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "launch_watchlist")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LaunchWatchlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String launchExternalId;
    private String missionName;
    private String rocketName;
    private LocalDateTime launchTime;
    private String launchPad;
    private String status;
}
