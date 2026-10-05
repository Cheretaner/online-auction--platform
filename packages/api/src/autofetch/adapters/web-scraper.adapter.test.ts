import { describe, expect, it } from 'vitest';
import { WebScraperAdapter } from './web-scraper.adapter.js';

describe('Telegram public preview extraction', () => {
  it('extracts each post as a linked review record', () => {
    const adapter = new WebScraperAdapter();
    const html = `
      <div class="tgme_widget_message" data-post="auctionet/1124">
        <div class="tgme_widget_message_text js-message_text">New auction. Asset name: Office chairs 🆔 Lot No: A-1</div>
      </div>
      <div class="tgme_widget_message" data-post="auctionet/1125">
        <div class="tgme_widget_message_text js-message_text">Next notice &amp; details</div>
      </div>`;

    const records = (adapter as any).extractTelegramMessages(html, 'https://t.me/s/auctionet');

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      title: 'Office chairs',
      externalId: 'auctionet/1124',
      sourceUrl: 'https://t.me/auctionet/1124',
      channel: 'auctionet',
    });
    expect(records[1]).toMatchObject({
      title: 'Next notice & details',
      externalId: 'auctionet/1125',
    });
  });
});