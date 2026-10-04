import { afterEach, describe, expect, it, vi } from 'vitest';
import { RssFeedAdapter } from './rss-feed.adapter.js';

afterEach(() => vi.unstubAllGlobals());

describe('RSS keyword filtering', () => {
  it('keeps only entries that contain every configured keyword', async () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item><title>Ethiopia public tender for office supplies</title><description>Procurement notice</description><link>https://example.com/1</link></item>
      <item><title>Kenya railways property sale</title><description>Public tender notice</description><link>https://example.com/2</link></item>
      <item><title>Ethiopia market update</title><description>Business news</description><link>https://example.com/3</link></item>
    </channel></rss>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(feed, { status: 200 })));

    const adapter = new RssFeedAdapter();
    const config = { url: 'https://example.com/feed.xml', includeKeywords: ['Ethiopia', 'tender'] };
    await adapter.validateConfig(config);
    adapter.configure(config);

    const items = await adapter.fetchItems('', { timeout: 1000, retryCount: 0 });

    expect(items.map((item) => item.title)).toEqual(['Ethiopia public tender for office supplies']);
  });
});