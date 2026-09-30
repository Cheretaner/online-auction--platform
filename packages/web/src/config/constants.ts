export const STORAGE_KEYS = {
  accessToken: "cheretanet.accessToken",
  refreshToken: "cheretanet.refreshToken",
  session: "cheretanet.session",
} as const;

export const API_PREFIX = "/api/v1";

export const QUERY_STALE_TIMES = {
  short: 15_000,
  default: 30_000,
  long: 5 * 60_000,
  catalog: 20_000,
} as const;
