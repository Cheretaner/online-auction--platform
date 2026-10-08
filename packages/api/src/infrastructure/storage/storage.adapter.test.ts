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
    let storageError: (Error & { statusCode: string; status?: number }) | null = null;
    const storageClient = {
      storage: {
        from: () => ({
          upload: async (path: string, data: Buffer, options: { contentType: string }) => {
            const copiedData = new Uint8Array(data).slice().buffer;
            objects.set(path, { data: copiedData, contentType: options.contentType });
            return { data: { path } };
          },
          download: async (path: string) => {
            if (storageError) return { data: null, error: storageError };
            const object = objects.get(path);
            return {
              data: object
                ? new Blob([object.data], { type: object.contentType })
                : null,
              error: null,
            };
          },
          exists: async (path: string) => ({
            data: objects.has(path),
            error: storageError,
          }),
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
    expect(await storage.get("uploads/test.pdf")).toBeNull();

    storageError = Object.assign(new Error("Object not found"), { statusCode: "404" });
    expect(await storage.get("uploads/missing.pdf")).toBeNull();
    expect(await storage.exists("uploads/missing.pdf")).toBe(false);

    storageError = Object.assign(new Error("Object not found"), { statusCode: "400", status: 400 });
    expect(await storage.exists("uploads/missing.pdf")).toBe(false);

    storageError = Object.assign(new Error("Storage service unavailable"), { statusCode: "500" });
    await expect(storage.get("uploads/test.pdf")).rejects.toThrow("Storage service unavailable");
    await expect(storage.exists("uploads/test.pdf")).rejects.toThrow("Storage service unavailable");
  });
});
