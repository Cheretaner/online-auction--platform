import { env } from "../../config/env.js";
import { AppError, HttpStatus } from "../../shared/errors/index.js";
import { logger } from "../../shared/utils/logger.js";

export interface AiProviderAdapter {
  categorize(text: string): Promise<{ category: string; confidence: number }>;
  detectAnomaly(input: Record<string, unknown>): Promise<{ flagged: boolean; reason?: string }>;
  assist(prompt: string): Promise<string>;
}

export class StubAiProviderAdapter implements AiProviderAdapter {
  async categorize(text: string) {
    const lowered = text.toLowerCase();
    const category = lowered.includes("vehicle") || lowered.includes("car")
      ? "vehicles"
      : lowered.includes("property") || lowered.includes("land")
        ? "property"
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
    return `Stub response for: ${prompt.slice(0, 120)}`;
  }
}

export class OpenAiProviderAdapter implements AiProviderAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  private async complete(system: string, user: string): Promise<string> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "AI provider request failed");
      throw new AppError("AI provider unavailable", HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE");
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() ?? "";
  }

  async categorize(text: string) {
    const raw = await this.complete(
      'Return JSON only: {"category":"string","confidence":number between 0 and 1}',
      text,
    );
    try {
      const parsed = JSON.parse(raw) as { category?: string; confidence?: number };
      return {
        category: parsed.category ?? "general",
        confidence: Number(parsed.confidence ?? 0.5),
      };
    } catch {
      return { category: "general", confidence: 0.4 };
    }
  }

  async detectAnomaly(input: Record<string, unknown>) {
    const raw = await this.complete(
      'Return JSON only: {"flagged":boolean,"reason":"string optional"}',
      JSON.stringify(input),
    );
    try {
      const parsed = JSON.parse(raw) as { flagged?: boolean; reason?: string };
      return { flagged: Boolean(parsed.flagged), reason: parsed.reason };
    } catch {
      return { flagged: false };
    }
  }

  async assist(prompt: string) {
    return this.complete("You are an auction operations assistant. Be concise.", prompt);
  }
}

export function createAiProviderAdapter(): AiProviderAdapter {
  if (env.AI_PROVIDER === "openai") {
    if (!env.AI_API_KEY) {
      throw new Error("AI_API_KEY is required when AI_PROVIDER=openai");
    }
    return new OpenAiProviderAdapter(env.AI_API_KEY, env.AI_BASE_URL, env.AI_MODEL);
  }
  return new StubAiProviderAdapter();
}

export const aiProviderAdapter: AiProviderAdapter = createAiProviderAdapter();
