import dotenv from "dotenv";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Resolve the .env files by walking outward from this module rather than
// trusting `process.cwd()`, which is only `packages/api` when the dev script
// runs and the repository root when `node packages/api/dist/server.js` is
// started directly. This file sits at `src/config/env.ts` before the build and
// `dist/config/env.js` after it, so two levels up is always the api package
// root in both cases.
const moduleDir = dirname(fileURLToPath(import.meta.url));
const apiPackageDir = resolve(moduleDir, "../..");
const monorepoRoot = resolve(apiPackageDir, "../..");

// Order matters: dotenv never overwrites an already-set variable, so real
// environment variables (systemd, a PaaS) always win over files, and
// the package-local file wins over the monorepo-root one.
for (const candidate of [
  resolve(apiPackageDir, ".env"),
  resolve(monorepoRoot, ".env"),
  resolve(process.cwd(), ".env"),
]) {
  dotenv.config({ path: candidate, quiet: true });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_SSL: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    JWT_SECRET: z.string().min(32).default("dev-secret-change-me-in-production-32chars"),
    JWT_REFRESH_SECRET: z.string().min(32).optional(),
    JWT_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    JWT_ISSUER: z.string().default("auction-api"),
    JWT_AUDIENCE: z.string().default("auction-web"),
    CORS_ORIGIN: z.string().default("*"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    SUBMISSION_RATE_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60_000),
    SUBMISSION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(15),
    // Number of reverse proxies in front of the API. Needed so
    // express-rate-limit and audit IP hashing see the real client address.
    // Leave at 0 when the process is exposed directly.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    // The account allowed to bootstrap the platform as super_admin. When
    // unset, the first account ever registered is promoted instead.
    BOOTSTRAP_SUPER_ADMIN_EMAIL: z.string().email().optional(),
    // Interval for the auction lifecycle sweep (scheduled -> live -> closed).
    AUCTION_TICK_MS: z.coerce.number().int().positive().default(10_000),
    // Pepper for hashing bidder IP addresses in the audit trail. Falls back
    // to JWT_SECRET so existing deployments keep working.
    IP_HASH_PEPPER: z.string().min(16).optional(),
    // TLS to the database. DATABASE_CA_CERT (PEM contents) is preferred for
    // managed providers; otherwise the platform trust store is used.
    DATABASE_SSL_REJECT_UNAUTHORIZED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    DATABASE_CA_CERT: z.string().optional(),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    RUN_MIGRATIONS_ON_BOOT: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    STORAGE_DRIVER: z.enum(["memory", "filesystem"]).default("filesystem"),
    STORAGE_DIR: z.string().default("./data/storage"),
    FILE_SCAN_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    CLAMAV_HOST: z.string().default("127.0.0.1"),
    CLAMAV_PORT: z.coerce.number().int().positive().max(65535).default(3310),
    FILE_SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    SETTLEMENT_DUE_HOURS: z.coerce.number().int().positive().default(72),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    MAIL_FROM: z.string().default("noreply@localhost"),
    
    AI_PROVIDER: z.enum(["auto", "stub", "gemini", "openrouter"]).default("auto"),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai"),
    GEMINI_MODEL: z.string().default("gemini-flash-latest"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENROUTER_MODEL: z.string().default("openrouter/free"),
    OPENROUTER_TRANSCRIPTION_MODEL: z.string().default("openai/whisper-1"),
    OPENROUTER_SITE_URL: z.string().default("http://localhost:3000"),
    OPENROUTER_SITE_NAME: z.string().default("AI-Powered Transparent Online Auction System"),
    IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
    REQUEST_BODY_LIMIT: z.string().default("2mb"),
    TELEGRAM_BOT_TOKEN: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
    TELEGRAM_BOT_USERNAME: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
    TELEGRAM_CHANNEL_ID: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
    TELEGRAM_WEBHOOK_URL: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().url().optional()),
    TELEGRAM_WEBHOOK_SECRET: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
    TELEGRAM_API_ROOT: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().url().optional()),
    TELEGRAM_POLLING: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    CHAPA_SECRET_KEY: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().optional(),
    ),
    CHAPA_PUBLIC_KEY: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().optional(),
    ),
    CHAPA_WEBHOOK_SECRET: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().optional(),
    ),
    PII_ENCRYPTION_KEY: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().min(32).optional(),
    ),
    PII_HASH_SECRET: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().min(32).optional(),
    ),
    WEB_BASE_URL: z.string().default("http://localhost:5173"),
    
    // Twilio voice/SMS configuration
    TWILIO_ACCOUNT_SID: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
    TWILIO_AUTH_TOKEN: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
    TWILIO_PHONE_NUMBER: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().optional()),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.FILE_SCAN_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FILE_SCAN_ENABLED"],
        message: "must be true in production so uploads are scanned before storage",
      });
    }
    if (value.NODE_ENV === "production" && value.STORAGE_DRIVER !== "filesystem") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_DRIVER"],
        message: "must be filesystem in production; use a persistent mounted volume for uploaded documents",
      });
    }
    if (value.NODE_ENV === "production" && !isAbsolute(value.STORAGE_DIR)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_DIR"],
        message: "must be an absolute path on a persistent mounted volume in production",
      });
    }
    if (Boolean(value.CHAPA_SECRET_KEY) !== Boolean(value.CHAPA_WEBHOOK_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [value.CHAPA_SECRET_KEY ? "CHAPA_WEBHOOK_SECRET" : "CHAPA_SECRET_KEY"],
        message: "must be set together with the other Chapa credential",
      });
    }
    if (value.NODE_ENV === "production" && !value.PII_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PII_ENCRYPTION_KEY"],
        message: "is required in production to encrypt identity data at rest",
      });
    }
    if (value.NODE_ENV === "production" && !value.PII_HASH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PII_HASH_SECRET"],
        message: "is required in production to create keyed identity lookup digests",
      });
    }
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [value.SMTP_USER ? "SMTP_PASS" : "SMTP_USER"],
        message: "must be set together with the other SMTP authentication field",
      });
    }
    if (value.NODE_ENV === "production" && !value.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message: "is required in production so password resets and email notifications are deliverable",
      });
    }
    if (value.NODE_ENV === "production" && !z.string().email().safeParse(value.MAIL_FROM).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MAIL_FROM"],
        message: "must be a valid sender email address in production",
      });
    }
    if (value.NODE_ENV === "production") {
      const hasGemini = Boolean(value.GEMINI_API_KEY?.trim());
      const hasOpenRouter = Boolean(value.OPENROUTER_API_KEY?.trim());
      const hasConfiguredProvider =
        (value.AI_PROVIDER === "gemini" && hasGemini) ||
        (value.AI_PROVIDER === "openrouter" && hasOpenRouter) ||
        (value.AI_PROVIDER === "auto" && (hasGemini || hasOpenRouter));
      if (!hasConfiguredProvider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AI_PROVIDER"],
          message: "production requires a configured Gemini or OpenRouter API key; the stub provider is for development only",
        });
      }
    }
    if (value.NODE_ENV === "production" && !value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "is required in production so refresh tokens are signed with a separate secret",
      });
    }
    if (value.NODE_ENV === "production" && value.JWT_SECRET.includes("dev-secret")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "must be set to a non-default value in production",
      });
    }
    if (value.NODE_ENV === "production" && value.CORS_ORIGIN === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGIN"],
        message: "must list explicit origins in production, not '*'",
      });
    }
    if (value.NODE_ENV === "production" && !value.BOOTSTRAP_SUPER_ADMIN_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BOOTSTRAP_SUPER_ADMIN_EMAIL"],
        message: "is required in production so the super_admin account cannot be claimed by the first sign-up",
      });
    }
    if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "is required in production",
      });
    }
    if (value.NODE_ENV === "production" && value.TELEGRAM_BOT_TOKEN && !value.TELEGRAM_WEBHOOK_URL && !value.TELEGRAM_POLLING) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TELEGRAM_WEBHOOK_URL"],
        message: "or TELEGRAM_POLLING=true is required when TELEGRAM_BOT_TOKEN is configured in production",
      });
    }
    if (value.NODE_ENV === "production" && value.TELEGRAM_WEBHOOK_URL && !value.TELEGRAM_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TELEGRAM_WEBHOOK_SECRET"],
        message: "is required when a production Telegram webhook is configured",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}

export const env = loadEnv();
