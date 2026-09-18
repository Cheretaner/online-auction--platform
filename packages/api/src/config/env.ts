import dotenv from "dotenv";
import { z } from "zod";

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
    // AI provider chain: Gemini first, OpenRouter as fallback, then a
    // deterministic stub. "auto" tries whichever of Gemini/OpenRouter has
    // an API key configured, in that order. Groq and paid providers are
    // deliberately not supported here - see provider.adapter.ts.
    AI_PROVIDER: z.enum(["auto", "gemini", "openrouter", "stub"]).default("auto"),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai"),
    GEMINI_MODEL: z.string().default("gemini-flash-latest"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENROUTER_MODEL: z.string().default("google/gemini-2.0-flash-exp:free"),
    OPENROUTER_SITE_URL: z.string().default("http://localhost:3000"),
    OPENROUTER_SITE_NAME: z.string().default("AI-Powered Transparent Online Auction System"),
    IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
    REQUEST_BODY_LIMIT: z.string().default("2mb"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.JWT_SECRET.includes("dev-secret")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "must be set to a non-default value in production",
      });
    }
    if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "is required in production",
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
