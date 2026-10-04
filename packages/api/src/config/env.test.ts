import { afterEach, describe, expect, it, vi } from "vitest";

describe("production environment hardening", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("requires a dedicated refresh secret in production even when the main JWT secret is already custom", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-production-safe-secret-32+chars";
    delete process.env.JWT_REFRESH_SECRET;
    process.env.CORS_ORIGIN = "https://example.com";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/app";
    process.env.FILE_SCAN_ENABLED = "true";
    process.env.STORAGE_DRIVER = "filesystem";
    process.env.STORAGE_DIR = "/tmp/uploads";
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = "admin@example.com";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.AI_PROVIDER = "gemini";
    process.env.CHAPA_SECRET_KEY = "chapa-secret";
    process.env.CHAPA_WEBHOOK_SECRET = "chapa-webhook-secret";
    process.env.PII_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef";
    process.env.PII_HASH_SECRET = "abcdef1234567890abcdef1234567890abcd";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "smtp-user";
    process.env.SMTP_PASS = "smtp-pass";
    process.env.MAIL_FROM = "noreply@example.com";

    await expect(import("./env.js")).rejects.toThrow(/JWT_REFRESH_SECRET/);
  });
});
