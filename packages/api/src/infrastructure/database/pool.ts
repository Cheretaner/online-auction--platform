import pg from "pg";
import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";

const { Pool, types } = pg;

// pg returns int8 (BIGINT) as a string to avoid precision loss. COUNT(*) is
// int8, and every call site here already does Number(...) or ::text, so the
// default is left alone deliberately — parsing it as a JS number would
// silently corrupt large values.
void types;

let pool: pg.Pool | null = null;

function buildSslConfig(): pg.PoolConfig["ssl"] {
  if (!env.DATABASE_SSL) return undefined;

  // rejectUnauthorized:false accepts ANY certificate, which means TLS gives
  // encryption but no protection against a man in the middle. It is opt-in
  // rather than the default; supply DATABASE_CA_CERT for managed providers
  // that use a private CA.
  if (env.DATABASE_CA_CERT) {
    return { ca: env.DATABASE_CA_CERT, rejectUnauthorized: true };
  }

  if (!env.DATABASE_SSL_REJECT_UNAUTHORIZED) {
    logger.warn(
      "DATABASE_SSL_REJECT_UNAUTHORIZED=false — the database certificate is not verified",
    );
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

export function getPool(): pg.Pool {
  if (!pool) {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for database operations");
    }

    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      ssl: buildSslConfig(),

      // Without these, a network partition or a runaway query can pin every
      // pool slot indefinitely and the API stops serving with no error.
      connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
      // Server-side ceiling on any single statement. The bid path takes row
      // locks, so a stuck transaction would otherwise block every bidder on
      // that auction.
      statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      // Guards against a transaction that opens, locks a row, then stalls.
      idle_in_transaction_session_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      application_name: "auction-api",
    });

    // An idle client erroring (server restart, failover) emits here. Without
    // a listener Node treats it as an unhandled 'error' event and crashes
    // the process.
    pool.on("error", (err) => {
      logger.error({ err }, "Idle database client error");
    });
  }

  return pool;
}

export async function pingDatabase(): Promise<boolean> {
  if (!env.DATABASE_URL) return false;
  const result = await getPool().query<{ ok: number | string }>("SELECT 1 AS ok");
  return Number(result.rows[0]?.ok) === 1;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const closing = pool;
    pool = null;
    await closing.end();
  }
}
