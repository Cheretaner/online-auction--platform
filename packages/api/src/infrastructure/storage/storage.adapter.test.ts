import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter, SupabaseStorageAdapter } from "./storage.adapter.js";

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

describe("SupabaseStorageAdapter", () => {
  it("delegates storage operations while preserving the adapter contract", async () => {
    const objects = new Map<string, { data: ArrayBuffer; contentType: string }>();
    const storageClient = {
      storage: {
        from: () => ({
          upload: async (path: string, data: Buffer, options: { contentType: string }) => {
            const copiedData = new Uint8Array(data).slice().buffer;
            objects.set(path, { data: copiedData, contentType: options.contentType });
            return { data: { path } };
          },
          download: async (path: string) => {
            const object = objects.get(path);
            return {
              data: object
                ? new Blob([object.data], { type: object.contentType })
                : new Blob([new Uint8Array(0)]),
              error: null,
            };
          },
          exists: async (path: string) => ({ data: objects.has(path), error: null }),
          remove: async (paths: string[]) => {
            paths.forEach((path) => objects.delete(path));
            return { data: [], error: null };
          },
        }),
      },
    };
    const storage = new SupabaseStorageAdapter(storageClient as never, "documents");

    await storage.put("uploads/test.pdf", Buffer.from("pdf"), "application/pdf");
    expect(await storage.exists("uploads/test.pdf")).toBe(true);
    expect((await storage.get("uploads/test.pdf"))?.data.toString()).toBe("pdf");
    await storage.delete("uploads/test.pdf");
    expect(await storage.exists("uploads/test.pdf")).toBe(false);
  });
});
