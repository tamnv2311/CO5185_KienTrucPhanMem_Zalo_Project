import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useEffect } from "react";
import { ME_ID, store } from "../../data/store";
import { toMessage } from "../../api/liveApi";

/**
 * Realtime channel to chat-service (STOMP over SockJS through the gateway).
 * Only active in live mode for conversations that exist on the backend.
 */
export function useChatSocket(remoteConversationId: string | undefined, localConversationId: string) {
  useEffect(() => {
    if (!remoteConversationId || !store.isLive) return;
    let token: string | null = null;
    try { token = localStorage.getItem("accessToken"); } catch { /* ignore */ }
    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      connectHeaders: { Authorization: `Bearer ${token ?? ""}` },
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe(`/topic/conversations/${remoteConversationId}`, (frame: IMessage) => {
          const incoming = toMessage(JSON.parse(frame.body));
          const fromMe = incoming.senderId === store.getState().session?.userId;
          if (fromMe) return; // our own echo – already shown optimistically
          store.receive(localConversationId, { kind: "text", text: incoming.text }, incoming.senderId ?? "unknown", {
            id: incoming.id, clientMsgId: incoming.clientMsgId, seq: incoming.seq, createdAt: incoming.createdAt,
          });
        });
      },
    });
    client.activate();
    return () => { void client.deactivate(); };
  }, [remoteConversationId, localConversationId]);
}

export { ME_ID };
