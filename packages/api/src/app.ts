import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { aiRouter } from "./ai/ai.routes.js";
import { auditRouter } from "./audit/audit.routes.js";
import { auctionRouter, orgAuctionRouter } from "./auction/auction.routes.js";
import { auctionItemRouter } from "./auction/auction-item.routes.js";
import { categoryRouter } from "./auction/category.routes.js";
import { biddingRouter } from "./bidding/bidding.routes.js";
import { complianceRouter } from "./compliance/compliance.routes.js";
import { depositRouter } from "./deposit/deposit.routes.js";
import { disputeRouter } from "./dispute/dispute.routes.js";
import { documentRouter } from "./document/document.routes.js";
import { healthRouter } from "./health/health.routes.js";
import identityRouter from "./identity/identity.routes.js";
import { notificationRouter } from "./notification/notification.routes.js";
import { organizationRouter } from "./organization/organization.routes.js";
import { reportingRouter } from "./reporting/reporting.routes.js";
import { telegramRouter } from "./telegram/telegram.routes.js";
import verificationRouter from "./verification/verification.routes.js";
import { attachSseStream } from "./infrastructure/realtime/realtime.adapter.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { notFoundMiddleware } from "./shared/middleware/notFound.middleware.js";
import { apiRateLimiter } from "./shared/middleware/rateLimit.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/requestId.middleware.js";
import { requireAuth } from "./shared/middleware/auth.middleware.js";
import { getAuth } from "./shared/types/request.js";
import { logger } from "./shared/utils/logger.js";

export function createApp(): express.Express {
  const app = express();

  // A specific hop count, never `true`: express-rate-limit refuses a
  // permissive trust-proxy setting because it lets a client spoof
  // X-Forwarded-For and escape its own bucket.
  if (env.TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", env.TRUST_PROXY_HOPS);
  }
  app.disable("x-powered-by");

  app.use(requestIdMiddleware);
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
      exposedHeaders: ["x-request-id"],
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id ?? "unknown",
    }),
  );
  app.use(apiRateLimiter);

  app.use("/health", healthRouter);
  app.use("/api/v1/auth", identityRouter);
  app.use("/api/v1/organizations", organizationRouter);
  app.use("/api/v1/auctions", auctionRouter);
  app.use("/api/v1/auctions/:auctionId/bids", biddingRouter);
  app.use("/api/v1/auctions/:auctionId/items", auctionItemRouter);
  app.use("/api/v1/organizations/:orgId/auctions", orgAuctionRouter);
  app.use("/api/v1/categories", categoryRouter);
  app.use("/api/v1/deposits", depositRouter);
  app.use("/api/v1/documents", documentRouter);
  app.use("/api/v1/verifications", verificationRouter);
  app.use("/api/v1/audit", auditRouter);
  app.use("/api/v1/ai", aiRouter);
  app.use("/api/v1/compliance", complianceRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/disputes", disputeRouter);
  app.use("/api/v1/reports", reportingRouter);
  app.use("/api/v1/telegram", telegramRouter);

  // Server-sent events for live bid/auction updates. Channels look like
  // `auction:<id>` or `user:<id>`; a user may only subscribe to their own
  // personal channel.
  app.get("/api/v1/events", requireAuth(), (req, res) => {
    const auth = getAuth(req);
    const channel = typeof req.query.channel === "string" ? req.query.channel : "*";

    if (channel.startsWith("user:") && channel !== `user:${auth.userId}`) {
      res.status(403).json({ error: { message: "Forbidden", code: "FORBIDDEN" } });
      return;
    }

    const unsubscribe = attachSseStream(res, channel);

    // Without a keepalive, idle proxies drop the connection after ~60s.
    const keepAlive = setInterval(() => res.write(": ping\n\n"), 25_000);
    keepAlive.unref();

    req.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
