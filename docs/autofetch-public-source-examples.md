# AutoFetch public source examples

Use these as starter public sources for proof-of-life testing in the AutoFetch workflow.

## Recommended adapter

For real public feeds, use the `rss-feed` adapter when the source exposes an RSS/Atom feed.
RSS sources can set `adapterConfig.includeKeywords` to a list of terms; an item is queued only when the combined title and description contain every term.

For Google search pages or non-feed pages, use the `web-scraper` adapter.

## Google sources (RSS)

1. Government procurement and auction search
   - Name: Google News - Ethiopia procurement
   - Type: `rss-feed`
   - URL: `https://news.google.com/rss/search?q=Ethiopia+auction+government+procurement`
   - Required keywords: `Ethiopia, auction`

2. Public tender notices
   - Name: Google News - Ethiopia public tender
   - Type: `rss-feed`
   - URL: `https://news.google.com/rss/search?q=Ethiopia+public+tender+notice`
   - Required keywords: `Ethiopia, tender`

3. Civil works and bids
   - Name: Google News - Ethiopia bids
   - Type: `rss-feed`
   - URL: `https://news.google.com/rss/search?q=Ethiopia+bids+construction+procurement`

4. Supply and equipment procurement
   - Name: Google News - Ethiopia supply procurement
   - Type: `rss-feed`
   - URL: `https://news.google.com/rss/search?q=Ethiopia+supplier+procurement+auction`

5. Infrastructure and public works
   - Name: Google News - Ethiopia infrastructure procurement
   - Type: `rss-feed`
   - URL: `https://news.google.com/rss/search?q=Ethiopia+infrastructure+procurement+public+works`

## Telegram sources

Verified public channel: Auction Ethiopia (`@auctionet`)

- Name: Telegram - Auction Ethiopia
- Type: `web-scraper`
- URL: `https://t.me/s/auctionet`
- Adapter config: `{"aiExtraction": false}`
- Live check: 20 public posts fetched and queued successfully on 2026-10-04.

Use the `/s/<channel>` preview URL with `web-scraper`. The direct `t.me/<channel>` page is HTML, not RSS; public RSSHub access returned HTTP 403 during validation.

## How to add a source

1. Open the AutoFetch page in the app.
2. Select `rss-feed` for Google News, or `web-scraper` for the Telegram preview page.
3. Paste the full URL from one of the examples above.
4. Save the source.
5. The system now triggers an immediate fetch as soon as the source is created.

## Notes

- Google News RSS feeds returned 18-70 entries per query during validation; review results for relevance before approval.
- Imported Telegram posts also remain in the human review queue and are not published automatically.
- For other HTML sites, `web-scraper` supports structured metadata mappings and evidence-checked AI extraction; it does not use CSS selectors.
