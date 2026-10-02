import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encryptionKey(): Buffer {
  return deriveKey(env.PII_ENCRYPTION_KEY ?? env.JWT_SECRET);
}

function hashKey(): string {
  return env.PII_HASH_SECRET ?? env.JWT_SECRET;
}

export function encryptSensitive(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSensitive(value: string | null): string | null {
  if (value == null) return null;
  if (!value.startsWith("enc:v1:")) return value;
  const [, , ivHex, tagHex, ciphertextHex] = value.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error("Malformed encrypted identity data");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashSensitive(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.normalize("NFKC").trim().toUpperCase().replace(/[\s-]/g, "");
  return createHmac("sha256", hashKey()).update(normalized).digest("hex");
}