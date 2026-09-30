export interface CategorizationResult {
  /** Slug that exists in the taxonomy, or the canonicalised model answer when
   * nothing matched. */
  category: string;
  /** Human-readable category name, null when the suggestion matched nothing. */
  categoryName: string | null;
  confidence: number;
  /** Which adapter answered ("gemini", "openai-compat", "stub", ...). */
  provider: string;
  /** True when the deterministic stub answered instead of a real model. */
  fallback: boolean;
  /** Whether the answer resolved to a real category row. */
  matched: boolean;
  /** The raw string the model produced, before normalisation. */
  rawSuggestion: string;
  /** True when the suggestion was persisted onto the auction item. */
  applied: boolean;
  /** Short human-facing explanation of how the match was made. */
  reason: string;
}

export interface AnomalyResult {
  flagged: boolean;
  reason?: string;
}

/** A narrative risk assessment produced by the model, advisory only. */
export interface AnomalyAdvisory extends AnomalyResult {
  provider: string;
}
