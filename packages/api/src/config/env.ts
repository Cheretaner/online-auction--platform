import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load the monorepo-root .env first, then any .env in the working
// directory. dotenv never overwrites an already-set variable, so real
// environment variables (Docker, systemd, a PaaS) always win over files.
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
});
dotenv.config();

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
      .default("false")
      .transform((value) => value === "true"),
    STORAGE_DRIVER: z.enum(["memory", "filesystem"]).default("filesystem"),
    STORAGE_DIR: z.string().default("./data/storage"),
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
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai"),
    GEMINI_MODEL: z.string().default("gemini-flash-latest"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENROUTER_MODEL: z.string().default("liquid/lfm-2.5-2.6b:free"),
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
    WEB_BASE_URL: z.string().default("http://localhost:5173"),
  })
  .superRefine((value, ctx) => {
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
