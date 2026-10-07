export function buildGeminiUrl(baseUrl: string, model: string, apiKey: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export function extractGeminiText(response: unknown): string {
  const value = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = value.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!text) throw new Error("Gemini returned an empty completion");
  return text;
}

export interface NativeGeminiConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export async function completeWithGemini(
  config: NativeGeminiConfig,
  system: string,
  user: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(buildGeminiUrl(config.baseUrl, config.model, config.apiKey), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: `${system}\n\n${user}` }],
        }],
        generationConfig: { temperature: 0 },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`${config.name} request failed with ${response.status}: ${body.slice(0, 300)}`);
    }

    return extractGeminiText(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
