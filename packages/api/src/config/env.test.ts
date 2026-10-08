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
    process.env.JWT_REFRESH_SECRET = "";
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

  it("allows document-dependent features to be disabled explicitly in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-production-safe-secret-32+chars";
    process.env.JWT_REFRESH_SECRET = "another-long-and-production-safe-refresh-secret";
    process.env.CORS_ORIGIN = "https://example.com";
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/app";
    process.env.FILE_SCAN_ENABLED = "true";
    process.env.STORAGE_DRIVER = "filesystem";
    process.env.STORAGE_DIR = "/tmp/uploads";
    process.env.DOCUMENT_UPLOADS_ENABLED = "false";
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = "admin@example.com";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.AI_PROVIDER = "gemini";
    process.env.PII_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef";
    process.env.PII_HASH_SECRET = "abcdef1234567890abcdef1234567890abcd";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.MAIL_FROM = "noreply@example.com";

    const { env } = await import("./env.js");
    expect(env.DOCUMENT_UPLOADS_ENABLED).toBe(false);
  });

  it("allows production uploads with malware scanning explicitly disabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-production-safe-secret-32+chars";
    process.env.JWT_REFRESH_SECRET = "another-long-and-production-safe-refresh-secret";
    process.env.CORS_ORIGIN = "https://example.com";
    process.env.DATABASE_URL = "postgres://localhost:5432/app";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.FILE_SCAN_ENABLED = "false";
    process.env.DOCUMENT_UPLOADS_ENABLED = "true";
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = "admin@example.com";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.AI_PROVIDER = "gemini";
    process.env.PII_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef";
    process.env.PII_HASH_SECRET = "abcdef1234567890abcdef1234567890abcd";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASS = "";
    process.env.MAIL_FROM = "noreply@example.com";
    process.env.CHAPA_SECRET_KEY = "";
    process.env.CHAPA_WEBHOOK_SECRET = "";
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.TELEGRAM_WEBHOOK_URL = "";
    process.env.TELEGRAM_WEBHOOK_SECRET = "";

    const { env } = await import("./env.js");
    expect(env.FILE_SCAN_ENABLED).toBe(false);
    expect(env.DOCUMENT_UPLOADS_ENABLED).toBe(true);
  });

  it("requires Supabase credentials in production when the Supabase driver is selected", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-production-safe-secret-32+chars";
    process.env.JWT_REFRESH_SECRET = "another-long-and-production-safe-refresh-secret";
    process.env.CORS_ORIGIN = "https://example.com";
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/app";
    process.env.FILE_SCAN_ENABLED = "true";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = "admin@example.com";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.AI_PROVIDER = "gemini";
    process.env.PII_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef";
    process.env.PII_HASH_SECRET = "abcdef1234567890abcdef1234567890abcd";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.MAIL_FROM = "noreply@example.com";

    await expect(import("./env.js")).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("normalizes a Supabase REST API URL to the project URL used by Storage", async () => {
    process.env.NODE_ENV = "test";
    process.env.SUPABASE_URL = "https://example.supabase.co/rest/v1/";

    const { env } = await import("./env.js");
    expect(env.SUPABASE_URL).toBe("https://example.supabase.co");
  });
});
