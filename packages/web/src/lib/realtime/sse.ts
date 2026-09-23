import { env } from "@/config/env";
import { API_PREFIX } from "@/config/constants";
import { tokenStore } from "@/lib/auth/token-store";

export interface SseMessage {
  event: string;
  channel?: string;
  payload: unknown;
}

export function subscribeToEvents(
  channel: string,
  onMessage: (message: SseMessage) => void,
): () => void {
  const token = tokenStore.getAccessToken();
  if (!token) return () => undefined;

  const controller = new AbortController();
  const url = `${env.apiBaseUrl}${API_PREFIX}/events?channel=${encodeURIComponent(channel)}`;

  void (async () => {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const lines = block.split("\n");
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data) as { channel?: string; payload?: unknown };
            onMessage({ event: eventName, channel: parsed.channel, payload: parsed.payload });
          } catch {
            onMessage({ event: eventName, payload: data });
          }
          eventName = "message";
        }
      }
    } catch {
      // Abort and transient network errors are expected on unmount or reconnect.
    }
  })();

  return () => controller.abort();
}
