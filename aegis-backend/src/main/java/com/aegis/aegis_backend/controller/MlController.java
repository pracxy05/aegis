package com.aegis.aegis_backend.controller;

import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.MlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ml")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class MlController {

    private final MlService mlService;
    private final EventRepository eventRepository;

    @GetMapping("/earth-score")
    public ResponseEntity<Map<String, Object>> getEarthScore() {
        var events = eventRepository.findAll();
        return ResponseEntity.ok(mlService.getEarthScore(events));
    }

    @GetMapping("/predict/{id}")
    public ResponseEntity<Map<String, Object>> predictEvent(@PathVariable Long id) {
        return eventRepository.findById(id)
            .map(event -> ResponseEntity.ok(mlService.predictSeverity(event)))
            .orElse(ResponseEntity.notFound().build());
            
    }
}
