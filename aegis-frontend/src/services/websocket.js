import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

let stompClient = null;

export const connectWebSocket = (onAlert) => {
  const socket = new SockJS('http://localhost:8080/ws');
  stompClient = new Client({
    webSocketFactory: () => socket,
    reconnectDelay: 5000,
    onConnect: () => {
      console.log('🔗 AEGIS WebSocket connected');
      stompClient.subscribe('/topic/alerts', (message) => {
        const alert = JSON.parse(message.body);
        onAlert(alert);
      });
    },
    onDisconnect: () => console.log('❌ WebSocket disconnected'),
  });
  stompClient.activate();
};

export const disconnectWebSocket = () => {
  if (stompClient) stompClient.deactivate();
};
