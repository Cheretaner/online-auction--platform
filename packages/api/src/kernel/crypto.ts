import { createHash } from "node:crypto";

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashIp(ip: string | undefined, pepper: string): string | null {
  if (!ip) return null;
  return sha256Hex(`${pepper}:${ip}`);
}

export function hashPayload(value: unknown): string {
  return sha256Hex(JSON.stringify(value));
}
