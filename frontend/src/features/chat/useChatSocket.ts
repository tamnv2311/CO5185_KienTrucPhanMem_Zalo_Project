import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  seq: number;
  senderId: string;
  content: string;
  status: "SENT" | "DELIVERED" | "SEEN";
}

export function useChatSocket(conversationId: string, onMessage: (message: ChatMessage) => void) {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!conversationId) return;
    const token = localStorage.getItem("accessToken");
    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      connectHeaders: { Authorization: `Bearer ${token ?? ""}` },
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe(`/topic/conversations/${conversationId}`, (message: IMessage) => {
          handler.current(JSON.parse(message.body) as ChatMessage);
        });
      },
    });
    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [conversationId]);
}
