export type RealtimeEvent = {
  channel: string;
  event: string;
  payload: unknown;
};

export interface RealtimeAdapter {
  publish(event: RealtimeEvent): Promise<void>;
}

export class InMemoryRealtimeAdapter implements RealtimeAdapter {
  async publish(event: RealtimeEvent): Promise<void> {
    // Placeholder for websocket / SSE integration.
    void event;
  }
}

export const realtimeAdapter: RealtimeAdapter = new InMemoryRealtimeAdapter();
