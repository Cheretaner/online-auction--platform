import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";

export interface AiProviderAdapter {
  categorize(text: string): Promise<{ category: string; confidence: number }>;
  detectAnomaly(input: Record<string, unknown>): Promise<{ flagged: boolean; reason?: string }>;
  assist(prompt: string): Promise<string>;
}

/**
 * Deterministic, zero-dependency fallback. Per the SRS (NFR "no AI
 * dependency is on the critical path of bidding"), auction creation and
 * bidding must keep working even when every configured AI provider is
 * unavailable or rate limited, so this adapter is always the last link in
 * the fallback chain built by `createAiProviderAdapter`.
 */
export class StubAiProviderAdapter implements AiProviderAdapter {
  async categorize(text: string) {
    const lowered = text.toLowerCase();
    const category = lowered.includes("vehicle") || lowered.includes("car")
      ? "vehicles"
      : lowered.includes("property") || lowered.includes("land")
        ? "property"
        : lowered.includes("machine") || lowered.includes("equipment")
          ? "machinery"
          : lowered.includes("electronic") || lowered.includes("laptop") || lowered.includes("phone")
            ? "electronics"
            : "general";
    return { category, confidence: text.trim().length > 0 ? 0.55 : 0 };
  }

  async detectAnomaly(input: Record<string, unknown>) {
    const amount = Number(input.amount ?? 0);
    if (Number.isFinite(amount) && amount > 1_000_000) {
      return { flagged: true, reason: "Amount exceeds anomaly threshold" };
    }
    return { flagged: false };
  }

  async assist(prompt: string) {
    return `AI assistant is temporarily unavailable. Here is what you asked: ${prompt.slice(0, 160)}`;
  }
}

interface OpenAiCompatConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
}

/**
 * Adapter for any OpenAI-compatible `/chat/completions` endpoint. Both
 * Google Gemini (`.../v1beta/openai/`) and OpenRouter (`openrouter.ai/api/v1`)
 * expose this shape, so one implementation serves both providers - only
 * base URL, model, and headers differ.
 */
export class OpenAiCompatProviderAdapter implements AiProviderAdapter {
  constructor(private readonly config: OpenAiCompatConfig) {}

  private async complete(system: string, user: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          ...this.config.extraHeaders,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`${this.config.name} request failed with ${response.status}: ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }

  async categorize(text: string) {
    const raw = await this.complete(
      'Classify the auction item description into a category. Return JSON only, no prose: {"category":"string","confidence":number between 0 and 1}',
      text,
    );
    const parsed = JSON.parse(raw) as { category?: string; confidence?: number };
    return {
      category: parsed.category ?? "general",
      confidence: Number(parsed.confidence ?? 0.5),
    };
  }

  async detectAnomaly(input: Record<string, unknown>) {
    const raw = await this.complete(
      'Given behavioural bidding features, return JSON only, no prose: {"flagged":boolean,"reason":"short string, optional"}',
      JSON.stringify(input),
    );
    const parsed = JSON.parse(raw) as { flagged?: boolean; reason?: string };
    return { flagged: Boolean(parsed.flagged), reason: parsed.reason };
  }

  async assist(prompt: string) {
    return this.complete(
      "You are the auction platform's assistant. Answer concisely and only from the context given. Never state that a participant is fraudulent; anomaly flags are advisory evidence for a human reviewer, not a verdict.",
      prompt,
    );
  }
}

/**
 * Tries each adapter in order and falls back to the next one on any
 * failure (network error, timeout, non-2xx, malformed JSON). The chain
 * always ends in `StubAiProviderAdapter`, so a caller of this adapter can
 * never throw because "the AI provider" is down.
 */
export class FallbackAiProviderAdapter implements AiProviderAdapter {
  constructor(private readonly chain: AiProviderAdapter[]) {
    if (chain.length === 0) {
      throw new Error("FallbackAiProviderAdapter requires at least one adapter");
    }
  }

  private async run<T>(op: (adapter: AiProviderAdapter) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const [index, adapter] of this.chain.entries()) {
      try {
        return await op(adapter);
      } catch (error) {
        lastError = error;
        logger.warn(
          { adapter: adapter.constructor.name, position: index, err: error },
          "AI provider failed, trying next in fallback chain",
        );
      }
    }
    throw lastError;
  }

  categorize(text: string) {
    return this.run((adapter) => adapter.categorize(text));
  }

  detectAnomaly(input: Record<string, unknown>) {
    return this.run((adapter) => adapter.detectAnomaly(input));
  }

  assist(prompt: string) {
    return this.run((adapter) => adapter.assist(prompt));
  }
}

/**
 * Provider selection, in order of preference:
 *   1. Google Gemini (free-tier "preview"/"flash" models) - primary.
 *   2. OpenRouter (free-tier models) - automatic fallback if Gemini is
 *      unconfigured, unavailable, or rate limited.
 *   3. StubAiProviderAdapter - deterministic, always-on last resort.
 *
 * Groq and paid providers are intentionally not wired in. AI_PROVIDER can
 * force a single stage (useful for tests/CI, or to pin to one provider).
 */
export function createAiProviderAdapter(): AiProviderAdapter {
  if (env.AI_PROVIDER === "stub") {
    return new StubAiProviderAdapter();
  }

  const chain: AiProviderAdapter[] = [];

  const wantsGemini = env.AI_PROVIDER === "auto" || env.AI_PROVIDER === "gemini";
  if (wantsGemini && env.GEMINI_API_KEY) {
    chain.push(
      new OpenAiCompatProviderAdapter({
        name: "gemini",
        apiKey: env.GEMINI_API_KEY,
        baseUrl: env.GEMINI_BASE_URL,
        model: env.GEMINI_MODEL,
        timeoutMs: env.AI_TIMEOUT_MS,
      }),
    );
  } else if (env.AI_PROVIDER === "gemini") {
    logger.warn("AI_PROVIDER=gemini but GEMINI_API_KEY is not set; falling back to stub");
  }

  const wantsOpenRouter = env.AI_PROVIDER === "auto" || env.AI_PROVIDER === "openrouter";
  if (wantsOpenRouter && env.OPENROUTER_API_KEY) {
    chain.push(
      new OpenAiCompatProviderAdapter({
        name: "openrouter",
        apiKey: env.OPENROUTER_API_KEY,
        baseUrl: env.OPENROUTER_BASE_URL,
        model: env.OPENROUTER_MODEL,
        timeoutMs: env.AI_TIMEOUT_MS,
        extraHeaders: {
          "HTTP-Referer": env.OPENROUTER_SITE_URL,
          "X-Title": env.OPENROUTER_SITE_NAME,
        },
      }),
    );
  } else if (env.AI_PROVIDER === "openrouter") {
    logger.warn("AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set; falling back to stub");
  }

  // Always end in the stub so AI never blocks a request on the critical path.
  chain.push(new StubAiProviderAdapter());

  return chain.length === 1 ? chain[0] : new FallbackAiProviderAdapter(chain);
}

export const aiProviderAdapter: AiProviderAdapter = createAiProviderAdapter();
