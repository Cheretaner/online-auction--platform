import { afterEach, describe, expect, it } from "vitest";
import {
  clearIdempotencyStore,
  getIdempotentReplay,
  pruneExpiredIdempotencyKeys,
  setIdempotentReplay,
} from "./idempotency.js";

describe("idempotency store", () => {
  afterEach(() => {
    clearIdempotencyStore();
  });

  it("replays stored payloads", () => {
    setIdempotentReplay("bid:1", { id: "abc" }, 201);
    expect(getIdempotentReplay("bid:1")).toEqual({ id: "abc" });
  });

  it("prunes expired keys", () => {
    setIdempotentReplay("old", { id: "abc" });
    expect(pruneExpiredIdempotencyKeys(Date.now() + 48 * 60 * 60 * 1000)).toBe(1);
    expect(getIdempotentReplay("old")).toBeUndefined();
  });
});
