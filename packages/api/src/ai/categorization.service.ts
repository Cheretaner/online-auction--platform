import { aiProviderAdapter, normalizeCategoryKey } from "../infrastructure/ai/provider.adapter.js";
import * as repo from "./ai.repository.js";
import type { CategorizationResult } from "./ai.types.js";

const FALLBACK = [
  "property",
  "vehicles",
  "commercial-trucks-logistics-fleet",
  "heavy-construction-machinery",
  "agricultural-equipment-tractors",
  "industrial-machinery-plant-equipment",
  "electronics",
  "office-furniture-business-assets",
  "scrap-metal-raw-materials",
  "general",
] as const;

export function getItemAuctionId(itemId: string): Promise<string | null> {
  return repo.findItemAuctionId(itemId);
}

interface TaxonomyRow {
  slug: string;
  name: string;
}

/**
 * Resolves whatever the model answered to a slug that actually exists in the
 * taxonomy.
 *
 * This is the whole point of the function: models answer `Vehicles`,
 * `vehicles`, `VEHICLE` or `Vehicle Category` for the same row, while the
 * database stores the lowercase slug `vehicles`. Comparing the raw answer
 * against the slug set with exact equality discarded almost every real model
 * result and silently stored `general`.
 */
export function resolveCategory(
  answer: string,
  taxonomy: TaxonomyRow[],
): { slug: string; name: string; via: string } | null {
  const key = normalizeCategoryKey(answer);
  if (!key) return null;

  const singular = (value: string) => (value.length > 3 && value.endsWith("s") ? value.slice(0, -1) : value);

  // 1. Exact slug, once both sides are canonicalised.
  for (const row of taxonomy) {
    if (normalizeCategoryKey(row.slug) === key) return { slug: row.slug, name: row.name, via: "slug" };
  }

  // 2. The model named the category instead of using its slug.
  for (const row of taxonomy) {
    if (normalizeCategoryKey(row.name) === key) return { slug: row.slug, name: row.name, via: "name" };
  }

  // 3. Plural/singular drift ("Vehicle" against a row slugged "vehicles").
  for (const row of taxonomy) {
    const slug = normalizeCategoryKey(row.slug);
    const name = normalizeCategoryKey(row.name);
    if (singular(slug) === singular(key) || singular(name) === singular(key)) {
      return { slug: row.slug, name: row.name, via: "singular" };
    }
  }

  // 4. Loose containment ("vehicles-category", "heavy machinery truck").
  for (const row of taxonomy) {
    const slug = normalizeCategoryKey(row.slug);
    const name = normalizeCategoryKey(row.name);
    if ((slug.length > 3 && key.includes(slug)) || (name.length > 3 && key.includes(name))) {
      return { slug: row.slug, name: row.name, via: "contains" };
    }
  }

  return null;
}

export async function categorizeText(text: string, itemId?: string): Promise<CategorizationResult> {
  const fetched: TaxonomyRow[] = await repo
    .listCategories()
    .catch(() => FALLBACK.map((slug) => ({ slug, name: slug })));

  const rows = fetched.length > 0 ? fetched : FALLBACK.map((slug) => ({ slug, name: slug }));
  const result = await aiProviderAdapter.categorize(text, { allowedCategories: rows.map((row) => row.slug) });
  const confidence = Math.min(1, Math.max(0, result.confidence));

  const resolved = resolveCategory(result.category, rows);

  // When nothing in the taxonomy matches, keep the canonicalised model answer
  // as a free-text suggestion but never write a category that does not exist.
  const category = resolved?.slug ?? normalizeCategoryKey(result.category) ?? "general";

  let applied = false;
  if (itemId && resolved) {
    applied = await repo
      .applyItemCategory({
        itemId,
        categorySlug: resolved.slug,
        confidence,
        rationale: `AI suggestion "${result.category}" matched ${resolved.name} via ${resolved.via} (${confidence.toFixed(2)})`,
      });
  }

  return {
    category,
    categoryName: resolved?.name ?? null,
    confidence,
    provider: result.provider,
    fallback: result.fallback,
    matched: Boolean(resolved),
    rawSuggestion: result.category,
    applied,
    reason: resolved
      ? `Matched "${resolved.name}" via ${resolved.via}`
      : `No taxonomy match for "${result.category}" - left for a person to confirm`,
  };
}
