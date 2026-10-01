import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";

export interface AiCategorizeOptions {
  allowedCategories?: string[];
  /** Free-text hint (e.g. the seller's declared category) used only to bias
   * the choice, never to override the taxonomy. */
  hint?: string;
}

export interface AiCategorization {
  category: string;
  confidence: number;
  /** Name of the adapter that produced the answer, so callers and the UI can
   * tell a real model result from the deterministic fallback. */
  provider: string;
  /** True when the answer came from the always-on stub rather than a model. */
  fallback: boolean;
}

export interface AiAssistResult {
  answer: string;
  provider: string;
  fallback: boolean;
}

export interface AiProviderAdapter {
  categorize(text: string, options?: AiCategorizeOptions): Promise<AiCategorization>;
  detectAnomaly(input: Record<string, unknown>): Promise<{ flagged: boolean; reason?: string; provider?: string }>;
  assist(prompt: string): Promise<AiAssistResult>;
}

export function parseJsonLoose<T>(raw: string): T {
  const text = raw.trim();
  if (!text) throw new Error("AI provider returned an empty completion");

  const attempts: string[] = [];

  // Strip a leading ``` / ```json fence and its closing fence.
  const fenceMatch = text.match(/^```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch?.[1]) attempts.push(fenceMatch[1].trim());

  attempts.push(text);

  // Last resort: the widest balanced-looking object in the reply, which
  // handles "Sure! Here you go: {...} Hope that helps."
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));

  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`AI provider returned unparsable JSON: ${text.slice(0, 200)}`);
}

/**
 * Canonical form of a category key: lowercase, trimmed, separators collapsed.
 * Models answer "Vehicles", "vehicles", "VEHICLE" or "Vehicles Category" for
 * the same slug `vehicles`, so both sides of the comparison go through here.
 */
export function normalizeCategoryKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class StubAiProviderAdapter implements AiProviderAdapter {
  async categorize(text: string, options?: AiCategorizeOptions) {
    const lowered = text.toLowerCase();
    const allowed = options?.allowedCategories ?? [];
    const pick = (...slugs: string[]) => allowed.find((slug) => slugs.includes(slug)) ?? slugs[0];

    // Keep the deterministic fallback useful when a hosted AI provider is
    // unavailable: match specific asset types before the broad categories.
    const keywordCategory =
      /real estate|property|building|warehouse|land|plot|premise/.test(lowered)
        ? pick("property")
        : /truck|lorry|bus|trailer|fleet|logistic|cargo|transport|tipper|tractor unit/.test(lowered)
          ? pick("commercial-trucks-logistics-fleet", "vehicles")
          : /excavator|bulldozer|grader|wheel loader|backhoe|crane|earthmov|construction machinery|caterpillar/.test(lowered)
            ? pick("heavy-construction-machinery", "industrial-machinery-plant-equipment", "machinery")
            : /farm|agricultur|harvest|plough|cultivat|irrigat|seed drill|tractor/.test(lowered)
              ? pick("agricultural-equipment-tractors", "industrial-machinery-plant-equipment", "machinery")
              : /generator|compressor|lathe|industrial|manufactur|plant equipment|production line/.test(lowered)
                ? pick("industrial-machinery-plant-equipment", "machinery")
                : /computer|laptop|server|network|telecom|electronic|printer|phone|it infrastructure/.test(lowered)
                  ? pick("electronics")
                  : /furniture|desk|chair|cabinet|office equipment|business asset/.test(lowered)
                    ? pick("office-furniture-business-assets", "general")
                    : /scrap|raw material|recycl|metal|steel|copper|aluminium|aluminum/.test(lowered)
                      ? pick("scrap-metal-raw-materials", "general")
                      : /vehicle|automobile|car|suv|van|sedan|pickup/.test(lowered)
                        ? pick("vehicles")
                        : null;

    // Prefer a keyword hit against the real taxonomy (matched on slug or name)
    // so the fallback agrees with the categories the database actually has.
    const byTaxonomy = allowed.find((slug) => {
      const key = normalizeCategoryKey(slug);
      return (
        key.length > 3 &&
        (lowered.includes(key) || lowered.includes(key.replace(/-/g, " ")) || lowered.includes(key.replace(/s$/, "")))
      );
    });

    const category =
      keywordCategory ??
      byTaxonomy ??
      (lowered.includes("vehicle") || lowered.includes("car")
        ? "vehicles"
        : lowered.includes("property") || lowered.includes("land")
          ? "property"
          : lowered.includes("machine") || lowered.includes("equipment")
            ? pick("industrial-machinery-plant-equipment", "machinery")
            : lowered.includes("electronic") || lowered.includes("laptop") || lowered.includes("phone")
              ? "electronics"
              : "general");

    return { category, confidence: text.trim().length > 0 ? 0.55 : 0, provider: "stub", fallback: true };
  }

  async detectAnomaly(input: Record<string, unknown>) {
    const amount = Number(input.amount ?? 0);
    if (Number.isFinite(amount) && amount > 1_000_000) {
      return { flagged: true, reason: "Amount exceeds anomaly threshold", provider: "stub" };
    }
    return { flagged: false, provider: "stub" };
  }

  async assist(prompt: string) {
    return {
      answer: `AI assistant is temporarily unavailable. Here is what you asked: ${prompt.slice(0, 160)}`,
      provider: "stub",
      fallback: true,
    };
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

  async categorize(text: string, options?: AiCategorizeOptions): Promise<AiCategorization> {
    const allowed = options?.allowedCategories ?? [];
    const taxonomy = allowed.length
      ? `Choose exactly one of these lowercase category slugs: ${allowed.join(", ")}.`
      : "Choose a short lowercase category slug in English.";

    const system = [
      "You classify auction listings for a government asset-disposal platform.",
      taxonomy,
      "Reply with a single JSON object and nothing else, using exactly this shape:",
      '{"category":"<lowercase slug from the list>","confidence":<number between 0 and 1>}',
      "Rules: the category value must be copied verbatim from the list in lowercase.",
      "No markdown, no code fences, no commentary, no trailing text.",
    ].join(" ");

    const user = options?.hint ? `Declared category hint: ${options.hint}\n\nListing:\n${text}` : `Listing:\n${text}`;

    const raw = await this.complete(system, user);
    const parsed = parseJsonLoose<{ category?: unknown; confidence?: unknown }>(raw);

    const category = typeof parsed.category === "string" ? parsed.category.trim() : "";
    if (!category) {
      // Signal "no usable answer" so the fallback chain advances to the next
      // provider instead of accepting an empty category.
      throw new Error(`${this.config.name} categorization omitted a category`);
    }

    const rawConfidence = Number(parsed.confidence);
    const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence)) : 0.5;

    return { category, confidence, provider: this.config.name, fallback: false };
  }

  async detectAnomaly(input: Record<string, unknown>) {
    const raw = await this.complete(
      [
        "You review behavioural bidding features from a public auction for signs of collusive or manipulative patterns.",
        'Reply with a single JSON object and nothing else, using exactly this shape: {"flagged":true|false,"reason":"one short sentence"}',
        "No markdown, no code fences, no commentary.",
        "Be conservative: only flag when the features show a concrete pattern.",
      ].join(" "),
      JSON.stringify(input),
    );
    const parsed = parseJsonLoose<{ flagged?: unknown; reason?: unknown }>(raw);
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : undefined;
    return { flagged: Boolean(parsed.flagged), ...(reason ? { reason } : {}), provider: this.config.name };
  }

  async assist(prompt: string): Promise<AiAssistResult> {
    const answer = await this.complete(
      "You are the auction platform's assistant. Answer concisely and only from the context given. Never state that a participant is fraudulent; anomaly flags are advisory evidence for a human reviewer, not a verdict.",
      prompt,
    );
    return { answer, provider: this.config.name, fallback: false };
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

  categorize(text: string, options?: AiCategorizeOptions) {
    return this.run((adapter) => adapter.categorize(text, options));
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
