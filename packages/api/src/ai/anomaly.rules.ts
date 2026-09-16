export function scoreAnomaly(input: Record<string, unknown>): number {
  let score = 0;
  if (typeof input.amount === "string" && Number(input.amount) > 1_000_000) score += 0.5;
  if (input.rapidBids === true) score += 0.3;
  return score;
}
