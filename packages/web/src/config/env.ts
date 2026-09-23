import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\/$/, "") ?? ""),
  VITE_APP_NAME: z.string().min(1).default("Cheretanet"),
});

const parsed = envSchema.safeParse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
});

if (!parsed.success) {
  throw new Error(
    `Invalid web environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
  );
}

export const env = {
  apiBaseUrl: parsed.data.VITE_API_BASE_URL,
  appName: parsed.data.VITE_APP_NAME,
};

export const APP_NAME = env.appName;
export const APP_SHORT_NAME = "Cheretanet";
