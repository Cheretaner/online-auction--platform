export interface CategorizationResult {
  category: string;
  confidence: number;
}

export interface AnomalyResult {
  flagged: boolean;
  reason?: string;
}
