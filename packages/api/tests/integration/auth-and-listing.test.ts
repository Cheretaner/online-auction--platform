import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL, api, createAuction, createOrg, createUser, startTestApp, type TestContext } from "./helpers.js";

describe.skipIf(!TEST_DATABASE_URL)("sessions, password reset and catalogue paging (real Postgres)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  async function register() {
    const email = `user.${randomUUID().slice(0, 8)}@example.test`;
    const res = await api(ctx, "POST", "/api/v1/auth/register", {
      body: { email, password: "first-password-123", fullName: "Session Tester" },
    });
    expect(res.status).toBe(201);
    return { email, session: res.body };
  }

  describe("refresh tokens", () => {
    it("rotates on every refresh and refuses the old token", async () => {
      const { session } = await register();
      const first = await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
      expect(first.status).toBe(200);
      expect(first.body.refreshToken).not.toBe(session.refreshToken);

      const second = await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: first.body.refreshToken } });
      expect(second.status).toBe(200);
    });

    it("revokes the whole session when a used token is replayed after the grace window", async () => {
      const { session } = await register();
      const rotated = await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
      expect(rotated.status).toBe(200);

      // Age the first token's rotation past the multi-tab grace window.
      await ctx.pool.query(`UPDATE refresh_tokens SET revoked_at = now() - interval '5 minutes' WHERE replaced_by IS NOT NULL AND user_id = $1`, [
        session.user.id,
      ]);
      const replay = await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe("REFRESH_TOKEN_REUSED");

      // The legitimate successor is now dead too.
      const successor = await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: rotated.body.refreshToken } });
      expect(successor.status).toBe(401);
    });

    it("logs out server-side", async () => {
      const { session } = await register();
      const out = await api(ctx, "POST", "/api/v1/auth/logout", { body: { refreshToken: session.refreshToken } });
      expect(out.status).toBe(204);
      const after = await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
      expect(after.status).toBe(401);
    });
  });

  describe("password reset", () => {
    it("resets once with the emailed link and signs out existing sessions", async () => {
      const { mailAdapter } = await import("../../src/infrastructure/mail/mail.adapter.js");
      const send = vi.spyOn(mailAdapter, "send");
      const { email, session } = await register();

      const req = await api(ctx, "POST", "/api/v1/auth/password-reset/request", { body: { email } });
      expect(req.status).toBe(202);
      const body = send.mock.calls.at(-1)?.[0].body ?? "";
      const token = /token=([A-Za-z0-9_-]+)/.exec(body)?.[1];
      expect(token).toBeTruthy();

      const confirm = await api(ctx, "POST", "/api/v1/auth/password-reset/confirm", {
        body: { token, password: "second-password-456" },
      });
      expect(confirm.status).toBe(204);

      const reuse = await api(ctx, "POST", "/api/v1/auth/password-reset/confirm", {
        body: { token, password: "third-password-789" },
      });
      expect(reuse.status).toBe(400);

      expect((await api(ctx, "POST", "/api/v1/auth/login", { body: { email, password: "second-password-456" } })).status).toBe(200);
      expect((await api(ctx, "POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } })).status).toBe(401);
      send.mockRestore();
    });

    it("answers the same way for unknown addresses", async () => {
      const res = await api(ctx, "POST", "/api/v1/auth/password-reset/request", {
        body: { email: `nobody.${randomUUID().slice(0, 8)}@example.test` },
      });
      expect(res.status).toBe(202);
    });
  });

  describe("public catalogue", () => {
    it("pages and filters on the server", async () => {
      const orgId = await createOrg(ctx);
      const officerId = await createUser(ctx, { verified: true });
      const tag = randomUUID().slice(0, 8);
      for (let i = 0; i < 5; i += 1) {
        const id = await createAuction(ctx, { orgId, createdBy: officerId, status: "live" });
        await ctx.pool.query(`UPDATE auctions SET title = $2, region = 'Oromia' WHERE id = $1`, [id, `Tractor ${tag} ${i}`]);
      }
      const hidden = await createAuction(ctx, { orgId, createdBy: officerId, status: "draft" });
      await ctx.pool.query(`UPDATE auctions SET title = $2 WHERE id = $1`, [hidden, `Tractor ${tag} draft`]);

      const page1 = await api(ctx, "GET", `/api/v1/auctions?q=${tag}&limit=2&offset=0`);
      expect(page1.status).toBe(200);
      expect(page1.body.total).toBe(5);
      expect(page1.body.items).toHaveLength(2);

      const page3 = await api(ctx, "GET", `/api/v1/auctions?q=${tag}&limit=2&offset=4`);
      expect(page3.body.items).toHaveLength(1);

      const ids = new Set([...page1.body.items, ...page3.body.items].map((a: { id: string }) => a.id));
      expect(ids.size).toBe(3);

      const region = await api(ctx, "GET", `/api/v1/auctions?q=${tag}&region=oromia&status=live`);
      expect(region.body.total).toBe(5);

      const byOrg = await api(ctx, "GET", `/api/v1/auctions?q=${tag}&orgId=${orgId}`);
      expect(byOrg.body.total).toBe(5);
      const otherOrg = await api(ctx, "GET", `/api/v1/auctions?q=${tag}&orgId=${randomUUID()}`);
      expect(otherOrg.body.total).toBe(0);

      const bad = await api(ctx, "GET", `/api/v1/auctions?status=draft`);
      expect(bad.status).toBe(400);
    });
  });
});
