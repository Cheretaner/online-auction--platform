import pino from "pino";
import { env } from "../../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "@auction/api", env: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    remove: true,
  },
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }
      : undefined,
});
