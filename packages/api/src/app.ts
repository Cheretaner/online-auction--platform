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
import { settlementRouter } from "./settlement/settlement.routes.js";
import { createVerificationRouter } from "./verification/verification.routes.js";
import type { IdentityVerificationProvider } from "./verification/identity-provider.js";
import { attachSseStream } from "./infrastructure/realtime/realtime.adapter.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { notFoundMiddleware } from "./shared/middleware/notFound.middleware.js";
import { apiRateLimiter } from "./shared/middleware/rateLimit.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/requestId.middleware.js";
import { requireAuth } from "./shared/middleware/auth.middleware.js";
import { getAuth } from "./shared/types/request.js";
import { asyncHandler } from "./shared/middleware/asyncHandler.js";
import { authorizeEventChannel } from "./auction/auction-events.js";
import { logger } from "./shared/utils/logger.js";
import { registerBuiltInAdapters } from "./autofetch/adapters/index.js";
import { createAutofetchRouter } from "./autofetch/autofetch.routes.js";
import { getPool } from "./infrastructure/database/pool.js";
import { analyticsRouter } from "./analytics/analytics.routes.js";
import { watchlistRouter, savedSearchRouter, notificationPreferencesRouter } from "./watchlist/watchlist.routes.js";
import path from "node:path";
import { chapaWebhook } from "./payments/chapa.controller.js";
import { openDataRouter } from "./open-data/open-data.routes.js";

export function createApp(dependencies: { identityVerificationProvider?: IdentityVerificationProvider } = {}): express.Express {
  const app = express();
 const webDist = path.resolve("/app/packages/web/dist");

  app.use(express.static(webDist));
  // Register autofetch adapters at startup
  try {
    registerBuiltInAdapters();
    logger.debug("AutoFetch adapters registered");
  } catch (error) {
    logger.warn({ err: error }, "Could not register autofetch adapters");
  }

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
      // Bearer-token clients do not need cross-origin cookies. Never pair a
      // wildcard allow-list with credentials, which otherwise reflects every
      // arbitrary Origin and permits credentialed browser requests.
      credentials: env.CORS_ORIGIN !== "*",
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

  app.post("/api/v1/webhooks/chapa", chapaWebhook);

  app.use("/health", healthRouter);
  app.use("/api/v1/auth", identityRouter);
  app.use("/api/v1/organizations", organizationRouter);
  app.use("/api/v1/auctions", auctionRouter);
  app.use("/api/v1/auctions/:auctionId/bids", biddingRouter);
  app.use("/api/v1/auctions/:auctionId/items", auctionItemRouter);
  app.use("/api/v1/organizations/:orgId/auctions", orgAuctionRouter);
  app.use("/api/v1/categories", categoryRouter);
  app.use("/api/v1/deposits", depositRouter);
  app.use("/api/v1/settlements", settlementRouter);
  app.use("/api/v1/documents", documentRouter);
  app.use("/api/v1/verifications", createVerificationRouter(dependencies.identityVerificationProvider));
  app.use("/api/v1/audit", auditRouter);
  app.use("/api/v1/open-data", openDataRouter);
  app.use("/api/v1/ai", aiRouter);
  app.use("/api/v1/compliance", complianceRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/watchlists", watchlistRouter);
  app.use("/api/v1/disputes", disputeRouter);
  app.use("/api/v1/reports", reportingRouter);
  app.use("/api/v1/telegram", telegramRouter);
  app.use("/api/v1/autofetch", createAutofetchRouter(getPool()));
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/watchlist", watchlistRouter);
  app.use("/api/v1/saved-searches", savedSearchRouter);
  app.use("/api/v1/notification-preferences", notificationPreferencesRouter);

  // Server-sent events for live bid/auction updates. Clients subscribe to
  // exactly one channel: their own `user:<id>` feed or an `auction:<id>` they
  // can see. See auction/auction-events.ts for the access and redaction rules.
  app.get(
    "/api/v1/events",
    requireAuth(),
    asyncHandler(async (req, res) => {
      const auth = getAuth(req);
      const channel = typeof req.query.channel === "string" ? req.query.channel : undefined;
      const access = await authorizeEventChannel(channel, auth);
      if (!access.allowed) {
        const code = access.status === 403 ? "FORBIDDEN" : access.status === 404 ? "NOT_FOUND" : "BAD_REQUEST";
        res.status(access.status).json({ error: { message: access.message, code } });
        return;
      }

      const unsubscribe = attachSseStream(res, channel!, access.filter);

      // Without a keepalive, idle proxies drop the connection after ~60s.
      const keepAlive = setInterval(() => res.write(": ping\n\n"), 25_000);
      keepAlive.unref();

      req.on("close", () => {
        clearInterval(keepAlive);
        unsubscribe();
      });
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) return next();
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) next();
    });
  });
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
