package com.aegis.aegis_backend.controller;

import com.aegis.aegis_backend.scheduler.N2YOScheduler;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/satellites")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class SatelliteController {

    private final N2YOScheduler n2yoScheduler;

    @GetMapping("/iss")
    public ResponseEntity<Map<String, Object>> getISS() {
        Map<String, Object> pos = n2yoScheduler.getIssPosition();
        if (pos == null) return ResponseEntity.status(503).build();
        return ResponseEntity.ok(pos);
    }

    @GetMapping("/hubble")
    public ResponseEntity<Map<String, Object>> getHubble() {
        Map<String, Object> pos = n2yoScheduler.getHubblePosition();
        if (pos == null) return ResponseEntity.status(503).build();
        return ResponseEntity.ok(pos);
    }
}
