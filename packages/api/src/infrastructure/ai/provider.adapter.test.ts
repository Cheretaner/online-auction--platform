import { describe, expect, it } from "vitest";
import {
  FallbackAiProviderAdapter,
  type AiAssistResult,
  type AiCategorization,
  type AiProviderAdapter,
} from "./provider.adapter.js";

class FailingProvider implements AiProviderAdapter {
  readonly providerName = "failing";
  async categorize(_text: string, _options?: Parameters<AiProviderAdapter["categorize"]>[1]): Promise<AiCategorization> {
    throw new Error("unavailable");
  }
  async detectAnomaly(_input: Record<string, unknown>): Promise<{ flagged: boolean; reason?: string; provider?: string }> {
    throw new Error("unavailable");
  }
  async assist(_prompt: string): Promise<AiAssistResult> {
    throw new Error("unavailable");
  }
}

class SuccessfulProvider implements AiProviderAdapter {
  readonly providerName = "successful";
  async categorize(_text: string, _options?: Parameters<AiProviderAdapter["categorize"]>[1]): Promise<AiCategorization> {
    throw new Error("not used");
  }
  async detectAnomaly(_input: Record<string, unknown>): Promise<{ flagged: boolean; reason?: string; provider?: string }> {
    throw new Error("not used");
  }
  async assist(): Promise<AiAssistResult> {
    return { answer: "answered", provider: this.providerName, fallback: false };
  }
}

describe("FallbackAiProviderAdapter", () => {
  it("tries the alternate hosted provider after the preferred provider fails", async () => {
    const adapter = new FallbackAiProviderAdapter([
      new FailingProvider(),
      new SuccessfulProvider(),
    ]);

    await expect(adapter.assist("review this auction")).resolves.toEqual({
      answer: "answered",
      provider: "successful",
      fallback: true,
    });
  });
});
