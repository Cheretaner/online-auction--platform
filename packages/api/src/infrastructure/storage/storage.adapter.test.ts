import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "./storage.adapter.js";

describe("MemoryStorageAdapter", () => {
  it("stores and reads objects", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.put("org/doc.txt", Buffer.from("hello"), "text/plain");
    const stored = await storage.get("org/doc.txt");
    expect(stored?.contentType).toBe("text/plain");
    expect(stored?.data.toString()).toBe("hello");
    await storage.delete("org/doc.txt");
    expect(await storage.exists("org/doc.txt")).toBe(false);
  });

  it("rejects unsafe keys", async () => {
    const storage = new MemoryStorageAdapter();
    await expect(storage.put("../secret", Buffer.from("x"), "text/plain")).rejects.toThrow();
  });
});
