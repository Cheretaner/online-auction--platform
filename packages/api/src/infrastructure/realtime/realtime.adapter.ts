import { EventEmitter } from "node:events";
import type { Response } from "express";
import { logger } from "../../shared/utils/logger.js";

export type RealtimeEvent = {
  channel: string;
  event: string;
  payload: unknown;
};

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeAdapter {
  publish(event: RealtimeEvent): Promise<void>;
  subscribe(channel: string, listener: RealtimeListener): () => void;
}

export class InMemoryRealtimeAdapter implements RealtimeAdapter {
  private readonly bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(0);
  }

  async publish(event: RealtimeEvent): Promise<void> {
    logger.debug({ channel: event.channel, event: event.event }, "Realtime event");
    this.bus.emit(event.channel, event);
    this.bus.emit("*", event);
  }

  subscribe(channel: string, listener: RealtimeListener): () => void {
    this.bus.on(channel, listener);
    return () => {
      this.bus.off(channel, listener);
    };
  }
}

export function writeSse(res: Response, event: RealtimeEvent): void {
  res.write(`event: ${event.event}\ndata: ${JSON.stringify({ channel: event.channel, payload: event.payload })}\n\n`);
}

export function attachSseStream(res: Response, channel: string): () => void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(": connected\n\n");

  return realtimeAdapter.subscribe(channel, (event) => {
    writeSse(res, event);
  });
}

export const realtimeAdapter: RealtimeAdapter = new InMemoryRealtimeAdapter();
