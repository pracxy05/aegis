package com.aegis.aegis_backend.service;

import com.aegis.aegis_backend.model.Event;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastAlert(Event event) {
        messagingTemplate.convertAndSend("/topic/alerts", event);
    }
}
