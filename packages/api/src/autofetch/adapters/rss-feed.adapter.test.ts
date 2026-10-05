import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicSource } from './public-http.js';
import { RssFeedAdapter } from './rss-feed.adapter.js';

vi.mock('./public-http.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./public-http.js')>(),
  fetchPublicSource: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe('RSS keyword filtering', () => {
  it('keeps only entries that contain every configured keyword', async () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item><title>Kenya railways property sale</title><description>Public tender notice</description><link>https://example.com/2</link></item>
      <item><title>Ethiopia public tender for office supplies</title><description>Procurement notice</description><link>https://example.com/1</link></item>
      <item><title>Ethiopia market update</title><description>Business news</description><link>https://example.com/3</link></item>
    </channel></rss>`;
    vi.mocked(fetchPublicSource).mockResolvedValue({
      body: Buffer.from(feed),
      contentType: 'application/rss+xml',
    });

    const adapter = new RssFeedAdapter();
    const config = { url: 'https://example.com/feed.xml', includeKeywords: ['Ethiopia', 'tender'] };
    await adapter.validateConfig(config);
    adapter.configure(config);

    const items = await adapter.fetchItems('', { timeout: 1000, retryCount: 0, limit: 1 });

    expect(items.map((item) => item.title)).toEqual(['Ethiopia public tender for office supplies']);
    expect(fetchPublicSource).toHaveBeenCalledWith(config.url, expect.objectContaining({
      maxBytes: 5 * 1024 * 1024,
      acceptedContentType: expect.any(Function),
    }));
  });

  it('decodes RSS-escaped HTML into clean plain text', async () => {
    const feed = `<rss><channel><item>
      <title>Public auction notice</title>
      <description>&lt;a href=&quot;https://news.example/story&quot; target=&quot;_blank&quot;&gt;Peter Kenneth wins tender&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color=&quot;#6f6f6f&quot;&gt;The Example Voice&lt;/font&gt;</description>
      <link>https://news.example/feed-item</link>
    </item></channel></rss>`;
    vi.mocked(fetchPublicSource).mockResolvedValue({
      body: Buffer.from(feed),
      contentType: 'application/rss+xml',
    });
    const adapter = new RssFeedAdapter();
    adapter.configure({ url: 'https://example.com/feed.xml' });

    const [item] = await adapter.fetchItems('', { limit: 5 });

    expect(item?.description).toBe('Peter Kenneth wins tender The Example Voice');
    expect(item?.description).not.toContain('<');
    expect(item?.description).not.toContain('&lt;');
  });
});