import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env } from "../../config/env.js";
import { AppError, HttpStatus } from "../../shared/errors/index.js";

export interface StoredObject {
  data: Buffer;
  contentType: string;
}

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

function assertSafeKey(key: string): void {
  if (!key || key.includes("\0") || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new AppError("Invalid storage key", HttpStatus.BAD_REQUEST);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly files = new Map<string, StoredObject>();

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    assertSafeKey(key);
    this.files.set(key, { data, contentType });
    return key;
  }

  async get(key: string): Promise<StoredObject | null> {
    assertSafeKey(key);
    return this.files.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    this.files.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    assertSafeKey(key);
    return this.files.has(key);
  }
}

export class FilesystemStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDir: string) {}

  private resolveKey(key: string): string {
    assertSafeKey(key);
    const root = resolve(this.rootDir);
    const target = resolve(join(root, key.split("/").join(sep)));
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new AppError("Invalid storage key", HttpStatus.BAD_REQUEST);
    }
    return target;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType }), "utf8");
    return key;
  }

  async get(key: string): Promise<StoredObject | null> {
    const path = this.resolveKey(key);
    try {
      const data = await readFile(path);
      const metaRaw = await readFile(`${path}.meta.json`, "utf8").catch(() => "{}");
      const meta = JSON.parse(metaRaw) as { contentType?: string };
      return { data, contentType: meta.contentType ?? "application/octet-stream" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const path = this.resolveKey(key);
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    await unlink(`${path}.meta.json`).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }
}

export function createStorageAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === "memory") {
    return new MemoryStorageAdapter();
  }
  return new FilesystemStorageAdapter(env.STORAGE_DIR);
}

export const storageAdapter: StorageAdapter = createStorageAdapter();
