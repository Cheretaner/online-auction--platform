import { describe, expect, it } from "vitest";
import { InMemoryRealtimeAdapter } from "./realtime.adapter.js";

describe("InMemoryRealtimeAdapter", () => {
  it("delivers published events to subscribers", async () => {
    const realtime = new InMemoryRealtimeAdapter();
    const received: unknown[] = [];
    const unsubscribe = realtime.subscribe("auction:1", (event) => {
      received.push(event.payload);
    });

    await realtime.publish({ channel: "auction:1", event: "bid.placed", payload: { id: "bid-1" } });
    unsubscribe();
    await realtime.publish({ channel: "auction:1", event: "bid.placed", payload: { id: "bid-2" } });

    expect(received).toEqual([{ id: "bid-1" }]);
  });
});
