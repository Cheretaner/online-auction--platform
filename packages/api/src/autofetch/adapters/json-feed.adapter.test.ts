import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonFeedAdapter } from './json-feed.adapter.js';
import { fetchPublicSource } from './public-http.js';

vi.mock('./public-http.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./public-http.js')>(),
  fetchPublicSource: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe('JSON feed adapter', () => {
  it('caps returned items and creates stable identifiers for records without IDs', async () => {
    vi.mocked(fetchPublicSource).mockResolvedValue({
      body: Buffer.from(JSON.stringify({ items: [{ title: 'First lot' }, { title: 'Second lot' }] })),
      contentType: 'application/json',
    });
    const adapter = new JsonFeedAdapter();
    adapter.configure({ url: 'https://feeds.example/items', apiKey: 'test-token' });

    const [item] = await adapter.fetchItems('', { limit: 1 });

    expect(item?.title).toBe('First lot');
    expect(item?.externalId).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchPublicSource).toHaveBeenCalledWith('https://feeds.example/items', expect.objectContaining({
      maxBytes: 5 * 1024 * 1024,
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });

  it('rejects private source URLs during configuration validation', async () => {
    const adapter = new JsonFeedAdapter();
    await expect(adapter.validateConfig({ url: 'http://127.0.0.1/feed.json' })).rejects.toThrow();
  });
});
