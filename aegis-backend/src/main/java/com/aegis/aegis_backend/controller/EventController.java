package com.aegis.aegis_backend.controller;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class EventController {

    private final EventRepository eventRepository;

    @GetMapping
    public ResponseEntity<List<Event>> getAllEvents() {
        return ResponseEntity.ok(eventRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Event> getEventById(@PathVariable Long id) {
        return eventRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<Event>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(eventRepository.findByEventType(type.toUpperCase()));
    }

    @GetMapping("/severity/{severity}")
    public ResponseEntity<List<Event>> getBySeverity(@PathVariable String severity) {
        return ResponseEntity.ok(eventRepository.findBySeverity(severity.toUpperCase()));
    }
}
