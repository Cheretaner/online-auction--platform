import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import { scoreAnomaly } from "./anomaly.rules.js";
import type { AnomalyResult } from "./ai.types.js";

export async function detectAnomaly(input: Record<string, unknown>): Promise<AnomalyResult> {
  const provider = await aiProviderAdapter.detectAnomaly(input);
  const score = scoreAnomaly(input);
  if (provider.flagged || score >= 0.7) {
    return { flagged: true, reason: provider.reason ?? "Rule-based anomaly threshold exceeded" };
  }
  return { flagged: false };
}
