import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";

export async function askAssistant(prompt: string): Promise<{ answer: string }> {
  const answer = await aiProviderAdapter.assist(prompt);
  return { answer };
}
