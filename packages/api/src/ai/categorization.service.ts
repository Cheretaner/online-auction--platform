import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import type { CategorizationResult } from "./ai.types.js";

export async function categorizeText(text: string): Promise<CategorizationResult> {
  return aiProviderAdapter.categorize(text);
}
