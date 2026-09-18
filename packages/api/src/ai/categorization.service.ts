import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import * as repo from "./ai.repository.js";
import type { CategorizationResult } from "./ai.types.js";

const FALLBACK = ["vehicles", "property", "machinery", "electronics", "general"] as const;

export async function categorizeText(text: string, itemId?: string): Promise<CategorizationResult> {
  const taxonomy = await repo.listCategories().catch(() => FALLBACK.map((slug) => ({ slug, name: slug })));
  const slugs = new Set(taxonomy.map((row) => row.slug));
  const result = await aiProviderAdapter.categorize(text);
  const category = slugs.has(result.category) ? result.category : "general";
  const confidence = Math.min(1, Math.max(0, result.confidence));

  if (itemId) {
    await repo.applyItemCategory({
      itemId,
      categorySlug: category,
      confidence,
      rationale: `Suggested from listing text (${confidence.toFixed(2)})`,
    });
  }

  return { category, confidence };
}
