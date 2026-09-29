import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";
import { cleanupTestData, createTestOrg, createTestUser, addOrgOfficer } from "../setup.js";
import { getPool } from "../../infrastructure/database/pool.js";
import * as AuctionService from "../../auction/auction.service.js";
import type { AuctionStatus, CreateAuctionRequest } from "@auction/shared";

const app = createApp();

describe("Auction Lifecycle Integration Tests", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("T01 regression: Register with admin-x@cheretanet.org -> should NOT get super_admin role", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "admin-x@cheretanet.org",
        password: "Password123!",
        firstName: "Admin",
        lastName: "X"
      });
      
    // Assuming 201 Created or 200 OK
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    
    // Fetch the user from the database directly
    const pool = getPool();
    const result = await pool.query("SELECT roles, is_super_admin FROM users WHERE email = $1", ["admin-x@cheretanet.org"]);
    expect(result.rows.length).toBe(1);
    
    const user = result.rows[0];
    expect(user.is_super_admin).toBe(false);
    expect(user.roles).not.toContain("super_admin");
  });

  describe("State transitions", () => {
    it("State transitions: Create auction -> submit -> approve (two-person rule) -> scheduled -> live -> closed -> awarded. Test that illegal transitions throw.", async () => {
      const creator = await createTestUser("officer");
      const approver = await createTestUser("officer");
      const org = await createTestOrg();
      await addOrgOfficer(org.id, creator.id);
      await addOrgOfficer(org.id, approver.id);

      const now = new Date();
      const opensAt = new Date(now.getTime() + 100000).toISOString();
      const closesAt = new Date(now.getTime() + 200000).toISOString();

      const createData: CreateAuctionRequest = {
        title: "Test Auction",
        description: "Integration test auction",
        auctionType: "open_ascending",
        startPrice: "100.00",
        reservePrice: "200.00",
        opensAt,
        closesAt,
        depositAmount: "10.00",
        antiSnipeSeconds: 60,
        maxExtensions: 5
      };

      // 1. Create
      const auction = await AuctionService.createAuction(
        org.id, 
        { userId: creator.id, roles: ["officer"], organizationId: org.id },
        createData
      );
      expect(auction.status).toBe("draft");

      // 2. Add an item (required before submit)
      const pool = getPool();
      await pool.query(
        `INSERT INTO auction_items (id, auction_id, title, description) VALUES ($1, $2, 'Item 1', 'Desc')`,
        [crypto.randomUUID(), auction.id]
      );

      // Illegal transition: draft -> scheduled
      await expect(
        AuctionService.approveAuction(auction.id, org.id, { userId: approver.id, roles: ["officer"], organizationId: org.id })
      ).rejects.toThrow();

      // 3. Submit
      const submitted = await AuctionService.submitForApproval(
        auction.id,
        org.id,
        { userId: creator.id, roles: ["officer"], organizationId: org.id }
      );
      expect(submitted.status).toBe("pending_review");

      // 4. Approve (Two-person rule)
      const approved = await AuctionService.approveAuction(
        auction.id,
        org.id,
        { userId: approver.id, roles: ["officer"], organizationId: org.id }
      );
      expect(approved.status).toBe("scheduled");

      // 5. Scheduled -> Live
      // Direct transition using transitionAuction (system or manual)
      const live = await AuctionService.transitionAuction(
        auction.id,
        org.id,
        "live",
        { userId: creator.id, roles: ["officer"], organizationId: org.id }
      );
      expect(live.status).toBe("live");

      // 6. Live -> Closed
      const closed = await AuctionService.transitionAuction(
        auction.id,
        org.id,
        "closed",
        { userId: creator.id, roles: ["officer"], organizationId: org.id }
      );
      expect(closed.status).toBe("closed");

      // Set audit chain as intact since awarding requires it
      await pool.query(
        `INSERT INTO audit_events (id, auction_id, sequence_no, hash) VALUES ($1, $2, 0, 'mockhash')`,
        [crypto.randomUUID(), auction.id]
      );
      await pool.query(
        `UPDATE auctions SET last_audit_hash = 'mockhash', last_audit_sequence_no = 0 WHERE id = $1`,
        [auction.id]
      );

      // 7. Closed -> Awarded
      const awarded = await AuctionService.transitionAuction(
        auction.id,
        org.id,
        "awarded",
        { userId: creator.id, roles: ["officer"], organizationId: org.id }
      );
      expect(awarded.status).toBe("awarded");
    });
  });

  describe("Two-person rule", () => {
    it("Creator cannot approve their own auction", async () => {
      const creator = await createTestUser("officer");
      const org = await createTestOrg();
      await addOrgOfficer(org.id, creator.id);

      const now = new Date();
      const createData: CreateAuctionRequest = {
        title: "Test Auction",
        description: "Integration test auction",
        auctionType: "open_ascending",
        startPrice: "100.00",
        opensAt: new Date(now.getTime() + 100000).toISOString(),
        closesAt: new Date(now.getTime() + 200000).toISOString(),
        depositAmount: "0.00"
      };

      const auction = await AuctionService.createAuction(
        org.id, 
        { userId: creator.id, roles: ["officer"], organizationId: org.id },
        createData
      );

      const pool = getPool();
      await pool.query(
        `INSERT INTO auction_items (id, auction_id, title) VALUES ($1, $2, 'Item 1')`,
        [crypto.randomUUID(), auction.id]
      );

      await AuctionService.submitForApproval(
        auction.id,
        org.id,
        { userId: creator.id, roles: ["officer"], organizationId: org.id }
      );

      await expect(
        AuctionService.approveAuction(
          auction.id,
          org.id,
          { userId: creator.id, roles: ["officer"], organizationId: org.id }
        )
      ).rejects.toThrow(/Two-person rule/);
    });
  });

  describe("Cross-org isolation", () => {
    it("Officer from Org A cannot manage Org B's auction", async () => {
      const creatorA = await createTestUser("officer");
      const orgA = await createTestOrg();
      await addOrgOfficer(orgA.id, creatorA.id);

      const officerB = await createTestUser("officer");
      const orgB = await createTestOrg();
      await addOrgOfficer(orgB.id, officerB.id);

      const now = new Date();
      const createData: CreateAuctionRequest = {
        title: "Org A Auction",
        description: "Integration test auction",
        auctionType: "open_ascending",
        startPrice: "100.00",
        opensAt: new Date(now.getTime() + 100000).toISOString(),
        closesAt: new Date(now.getTime() + 200000).toISOString(),
        depositAmount: "0.00"
      };

      const auction = await AuctionService.createAuction(
        orgA.id, 
        { userId: creatorA.id, roles: ["officer"], organizationId: orgA.id },
        createData
      );

      await expect(
        AuctionService.submitForApproval(
          auction.id,
          orgB.id,
          { userId: officerB.id, roles: ["officer"], organizationId: orgB.id }
        )
      ).rejects.toThrow(/Forbidden/);
    });
  });
});
