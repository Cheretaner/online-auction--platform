import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { aiRouter } from "./ai/ai.routes.js";
import { auditRouter } from "./audit/audit.routes.js";
import { auctionRouter } from "./auction/auction.routes.js";
import { biddingRouter } from "./bidding/bidding.routes.js";
import { complianceRouter } from "./compliance/compliance.routes.js";
import { depositRouter } from "./deposit/deposit.routes.js";
import { disputeRouter } from "./dispute/dispute.routes.js";
import { documentRouter } from "./document/document.routes.js";
import { healthRouter } from "./health/health.routes.js";
import { identityRouter } from "./identity/identity.routes.js";
import { notificationRouter } from "./notification/notification.routes.js";
import { organizationRouter } from "./organization/organization.routes.js";
import { reportingRouter } from "./reporting/reporting.routes.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { apiRateLimiter } from "./shared/middleware/rateLimit.middleware.js";
import { logger } from "./shared/utils/logger.js";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));
  app.use(apiRateLimiter);

  app.use("/health", healthRouter);
  app.use("/api/v1/auth", identityRouter);
  app.use("/api/v1/organizations", organizationRouter);
  app.use("/api/v1/auctions", auctionRouter);
  app.use("/api/v1/auctions/:auctionId/bids", biddingRouter);
  app.use("/api/v1/deposits", depositRouter);
  app.use("/api/v1/documents", documentRouter);
  app.use("/api/v1/audit", auditRouter);
  app.use("/api/v1/ai", aiRouter);
  app.use("/api/v1/compliance", complianceRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/disputes", disputeRouter);
  app.use("/api/v1/reports", reportingRouter);

  app.use(errorMiddleware);

  return app;
}
