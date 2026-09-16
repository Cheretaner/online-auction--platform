export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly files = new Map<string, { data: Buffer; contentType: string }>();

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    this.files.set(key, { data, contentType });
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    return this.files.get(key)?.data ?? null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

export const storageAdapter: StorageAdapter = new LocalStorageAdapter();
