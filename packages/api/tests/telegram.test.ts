import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAuctionChannelMessage } from "../src/telegram/telegram-channel.service.js";
import { parseVoiceResponse, processVoiceNote } from "../src/telegram/telegram-voice.service.js";
import { telegramService } from "../src/telegram/telegram.service.js";
import type { Auction } from "../src/auction/auction.types.js";

describe("Telegram Channel Message Formatting", () => {
  const sampleAuction: Auction = {
    id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    orgId: "org-1",
    title: "Surplus Toyota Land Cruiser 2022",
    description: "Well maintained government utility vehicle with complete service history.",
    auctionType: "open_ascending",
    status: "live",
    startPrice: "1200000",
    reservePrice: "1500000",
    minIncrement: "20000",
    currentHighestBid: "1340000",
    bidCount: 7,
    depositAmount: "50000",
    eligibilityRules: "Open to Ethiopian citizens and licensed businesses",
    region: "Addis Ababa",
    antiSnipeSeconds: 120,
    maxExtensions: 5,
    sealedOpenedAt: null,
    closedAt: null,
    awardedAt: null,
    cancellationReason: null,
    opensAt: new Date(Date.now() - 3600_000),
    closesAt: new Date(Date.now() + 86400_000 * 2),
    originalClosesAt: new Date(Date.now() + 86400_000 * 2),
    extensionCount: 0,
    createdBy: "admin-1",
    approvedBy: "officer-1",
    winnerId: null,
    winningAmount: null,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("formats live open ascending auction card with rich HTML and displays current highest bid", () => {
    const card = formatAuctionChannelMessage(sampleAuction, "TestAuctionBot");

    expect(card.text).toContain("PUBLIC AUCTION NOTICE");
    expect(card.text).toContain("LIVE FOR BIDDING");
    expect(card.text).toContain("Surplus Toyota Land Cruiser 2022");
    expect(card.text).toContain("ETB 1,200,000.00");
    expect(card.text).toContain("ETB 1,340,000.00");
    expect(card.text).toContain("ETB 50,000.00");
    expect(card.text).toContain("Addis Ababa");

    // Inline buttons
    const buttons = card.replyMarkup.inline_keyboard;
    expect(buttons.length).toBe(2);
    expect(buttons[0][0].text).toContain("View on Portal");
    expect(buttons[0][1].text).toContain("Bid via Bot");
    expect(buttons[0][1].url).toContain("https://t.me/TestAuctionBot?start=view_");
    expect(buttons[1][0].text).toContain("Verify Audit Chain");
    expect(buttons[1][0].url).toContain("https://t.me/TestAuctionBot?start=verify_");
  });

  it("formats live sealed bid auction card hiding the current highest bid for secrecy", () => {
    const sealedAuction = { ...sampleAuction, auctionType: "sealed_bid" as const };
    const card = formatAuctionChannelMessage(sealedAuction, "TestAuctionBot");

    expect(card.text).toContain("🔒 Sealed Bid Auction");
    expect(card.text).not.toContain("Current Highest Bid");
    expect(card.text).toContain("ETB 1,200,000.00");
  });

  it("escapes special HTML characters in auction title and descriptions", () => {
    const dangerousAuction = {
      ...sampleAuction,
      title: "Vehicle <script>alert(1)</script> & Heavy Machinery",
      description: "Condition: <Great> & 'Tested' \"Reliable\"",
    };

    const card = formatAuctionChannelMessage(dangerousAuction, "TestAuctionBot");
    expect(card.text).not.toContain("<script>");
    expect(card.text).toContain("&lt;script&gt;");
    expect(card.text).toContain("&amp; Heavy Machinery");
  });
});

describe("Telegram Voice Processing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns fallback or parsed result when processing audio note", async () => {
    // Tests must never spend an API key, depend on network access, or send
    // test audio to an external provider.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ transcription: "test", intent: "help" }) }] } }],
      }),
    }));
    const fakeBuffer = Buffer.from("fake ogg opus audio data");
    const result = await processVoiceNote(fakeBuffer);

    expect(result).toHaveProperty("transcription");
    expect(result).toHaveProperty("intent");
    expect(typeof result.transcription).toBe("string");
  }, 15000);

  it("falls back safely when a provider returns malformed JSON for a voice note", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "not valid json" }] } }],
      }),
    }));

    const result = await processVoiceNote(Buffer.from("fake ogg opus audio data"));

    expect(result.available).toBe(false);
    expect(result.intent).toBe("help");
  }, 15000);

  it("parses malformed voice JSON into a safe help response instead of throwing", () => {
    const result = parseVoiceResponse("not valid json");

    expect(result.available).toBe(false);
    expect(result.intent).toBe("help");
  });
});

describe("Telegram Webhook Security", () => {
  it("rejects webhook update when secret header does not match configured secret", async () => {
    // If a webhook secret is set in env, mismatched header must throw
    const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    try {
      (telegramService as any).botService = {
        getBotInstance: () => ({ handleUpdate: async () => { } }),
      };

      // When secret header fails:
      if (process.env.TELEGRAM_WEBHOOK_SECRET) {
        await expect(
          telegramService.handleWebhookUpdate({ update_id: 123 }, "wrong-secret"),
        ).rejects.toThrow("Invalid Telegram webhook secret header");
      }
    } finally {
      process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
    }
  });
});
