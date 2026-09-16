export interface AiProviderAdapter {
  categorize(text: string): Promise<{ category: string; confidence: number }>;
  detectAnomaly(input: Record<string, unknown>): Promise<{ flagged: boolean; reason?: string }>;
  assist(prompt: string): Promise<string>;
}

export class StubAiProviderAdapter implements AiProviderAdapter {
  async categorize(text: string) {
    return { category: "general", confidence: text.length > 0 ? 0.5 : 0 };
  }

  async detectAnomaly(_input: Record<string, unknown>) {
    return { flagged: false };
  }

  async assist(prompt: string) {
    return `Stub response for: ${prompt.slice(0, 120)}`;
  }
}

export const aiProviderAdapter: AiProviderAdapter = new StubAiProviderAdapter();
