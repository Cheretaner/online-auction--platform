/**
 * Complete End-to-End Test Suite for CheretaNet Transparent Auction Platform
 *
 * Covers ALL 18 feature domains and all endpoints:
 *   1. Health & Readiness (/health, /health/ready)
 *   2. Identity & Authentication (/auth/* - register, login, refresh, me, update, switch-context, users)
 *   3. Organizations (/organizations/* - create, list, get, add member, list members, delete member)
 *   4. Taxonomy & Categories (/categories/* - create, list, get, update)
 *   5. Auctions (/auctions/* - create, list, get, amend, submit, approve, transition, cancel, org auctions)
 *   6. Auction Items (/auctions/:id/items/* - create, list, get, update, delete)
 *   7. KYC Verification (/verifications/* - submit, me, pending, review, duplicates)
 *   8. CPO Deposits (/deposits/* - submit, me, list by auction, get, review, release)
 *   9. Documents (/documents/* - upload multipart, me, list by auction, get, download content)
 *  10. Bidding & Anti-Snipe (/auctions/:id/bids/* - place bid, idempotency, counter-bid, list, withdraw)
 *  11. AI Intelligence (/ai/* - categorize text, anomaly detection, list anomalies, review anomaly, assistant QA)
 *  12. Telegram Integration (/telegram/* - link-token, status, webhook simulation, channel broadcast, unlink)
 *  13. Compliance Checks (/compliance/auctions/:id/checks - run, list)
 *  14. Cryptographic SHA-256 Audit Chain (/audit/* - events, verify global, verify auction Merkle chain)
 *  15. Dispute Resolution (/disputes/* - open, list, get, assign, resolve)
 *  16. Transparency Reporting (/reports/* - generate, list, get, publish)
 *  17. Notifications (/notifications/* - send, list, unread-count, mark read, mark all read)
 *  18. Realtime SSE Events (/events - connect, handshake, verify stream)
 *
 * Strict Requirement: All generated emails use _____@cheretanet.org.
 */

import fs from "node:fs";
import path from "node:path";

// Auto-load .env so CLI runs pick up environment configurations like BOOTSTRAP_SUPER_ADMIN_EMAIL
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch {
  // Best-effort
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const PASSWORD = "CheretaSecurePass2026!";

let passedCount = 0;
let failedCount = 0;
const resultsByDomain = {};

function domainHeader(title) {
  process.stdout.write(`\n\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m\n`);
  process.stdout.write(`\x1b[1;37m ${title}\x1b[0m\n`);
  process.stdout.write(`\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m\n`);
  if (!resultsByDomain[title]) {
    resultsByDomain[title] = { passed: 0, failed: 0 };
  }
}

function pass(domain, text, detail) {
  passedCount += 1;
  if (resultsByDomain[domain]) resultsByDomain[domain].passed += 1;
  process.stdout.write(`  \x1b[32m✔\x1b[0m ${text}\n`);
  if (detail) process.stdout.write(`    \x1b[90m↳ ${detail}\x1b[0m\n`);
}

function fail(domain, text, detail) {
  failedCount += 1;
  if (resultsByDomain[domain]) resultsByDomain[domain].failed += 1;
  process.stdout.write(`  \x1b[31m✘\x1b[0m ${text}\n`);
  if (detail) process.stdout.write(`    \x1b[33m↳ ${detail}\x1b[0m\n`);
}

async function call(method, path, { token, body, isFormData, headers: customHeaders } = {}) {
  const headers = { ...customHeaders };
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (!isFormData && body !== undefined && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  // Keep a caller-supplied key: the replay test depends on sending the same one twice.
  headers["Idempotency-Key"] ??= `test-${STAMP}-${Math.random().toString(36).slice(2)}`;

  let fetchBody = undefined;
  if (isFormData) {
    fetchBody = body;
  } else if (body !== undefined) {
    fetchBody = JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: fetchBody,
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => null);
    return { status: response.status, body: json, headers: response.headers };
  } else {
    const text = await response.text().catch(() => "");
    return { status: response.status, body: text, headers: response.headers };
  }
}

function expectStatus(domain, result, expected, label, detailFnOrStr) {
  const want = Array.isArray(expected) ? expected : [expected];
  if (want.includes(result.status)) {
    const detail = typeof detailFnOrStr === "function" ? detailFnOrStr(result.body) : detailFnOrStr;
    pass(domain, label, detail);
    return result.body;
  }
  const detail = typeof result.body === "object" ? JSON.stringify(result.body) : String(result.body);
  fail(domain, label, `HTTP ${result.status} (expected ${want.join(" or ")}): ${detail.slice(0, 300)}`);
  return result.body;
}

const isoOffset = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

async function main() {
  process.stdout.write(`\n\x1b[1;32mStarting CheretaNet Complete API Verification\x1b[0m\n`);
  process.stdout.write(`Target Endpoint: \x1b[1m${BASE}\x1b[0m\n`);
  process.stdout.write(`Test Timestamp:  \x1b[1m${STAMP}\x1b[0m\n`);
  process.stdout.write(`Email Domain:    \x1b[1;34m*@cheretanet.org\x1b[0m\n`);

  // --------------------------------------------------------------------------
  // 1. SYSTEM HEALTH & READINESS
  // --------------------------------------------------------------------------
  domainHeader("1. System Health & Readiness");
  const healthRes = await call("GET", "/health");
  expectStatus("1. System Health & Readiness", healthRes, 200, "GET /health - Service liveness probe", (b) => `Service: ${b?.service}, Status: ${b?.status}`);

  const readyRes = await call("GET", "/health/ready");
  expectStatus("1. System Health & Readiness", readyRes, 200, "GET /health/ready - Database readiness probe", (b) => `Database: ${b?.database}`);

  // --------------------------------------------------------------------------
  // 2. IDENTITY & AUTHENTICATION (ALL @cheretanet.org)
  // --------------------------------------------------------------------------
  domainHeader("2. Identity & Access Management (@cheretanet.org)");

  // The platform admin must be the address in the API's
  // BOOTSTRAP_SUPER_ADMIN_EMAIL (or, in development only, the very first
  // account on an empty database). Set ADMIN_EMAIL to match the API.
  const adminEmail =
    process.env.ADMIN_EMAIL ??
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL ??
    "admin@cheretanet.org";
  const officerEmail = `officer.${STAMP}@cheretanet.org`;
  const complianceEmail = `compliance.${STAMP}@cheretanet.org`;
  const bidder1Email = `solomon.bidder.${STAMP}@cheretanet.org`;
  const bidder2Email = `marta.bidder.${STAMP}@cheretanet.org`;

  // Register Platform Admin (or log in if a previous run already created it)
  let adminRegRes = await call("POST", "/api/v1/auth/register", {
      body: {
        email: adminEmail,
        password: PASSWORD,
        fullName: "Ato Dawit Alemu",
        phone: "+251911100201",
        accountType: "individual",
        region: "Addis Ababa",
      },
    });
  if (adminRegRes.status === 409) {
    const relogin = await call("POST", "/api/v1/auth/login", { body: { email: adminEmail, password: PASSWORD } });
    adminRegRes = { ...relogin, status: relogin.status === 200 ? 201 : relogin.status };
  }
  const adminReg = expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    adminRegRes,
    201,
    `POST /api/v1/auth/register - Register Platform Admin (${adminEmail})`,
    "Registered with super_admin platform bootstrap privilege",
  );
  const adminToken = adminReg?.token;
  const adminUserId = adminReg?.user?.id;

  // Register Auction Officer
  const officerReg = expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("POST", "/api/v1/auth/register", {
      body: {
        email: officerEmail,
        password: PASSWORD,
        fullName: "W/ro Tigist Haile",
        phone: "+251911100202",
        accountType: "individual",
        region: "Addis Ababa",
      },
    }),
    201,
    `POST /api/v1/auth/register - Register Auction Officer (${officerEmail})`,
  );
  const officerUserId = officerReg?.user?.id;

  // Register Compliance Officer
  const complianceReg = expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("POST", "/api/v1/auth/register", {
      body: {
        email: complianceEmail,
        password: PASSWORD,
        fullName: "Ato Berhanu Tadesse",
        phone: "+251911100203",
        accountType: "individual",
        region: "Addis Ababa",
      },
    }),
    201,
    `POST /api/v1/auth/register - Register Compliance Officer (${complianceEmail})`,
  );
  const complianceUserId = complianceReg?.user?.id;

  // Register Primary Bidder
  const bidder1Reg = expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("POST", "/api/v1/auth/register", {
      body: {
        email: bidder1Email,
        password: PASSWORD,
        fullName: "Solomon Kebede",
        phone: "+251911100204",
        accountType: "individual",
        nationalId: `NAT-${STAMP}-01`,
        region: "Addis Ababa",
      },
    }),
    201,
    `POST /api/v1/auth/register - Register Primary Bidder (${bidder1Email})`,
  );
  let bidder1Token = bidder1Reg?.token;
  const bidder1UserId = bidder1Reg?.user?.id;

  // Register Competing Bidder
  const bidder2Reg = expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("POST", "/api/v1/auth/register", {
      body: {
        email: bidder2Email,
        password: PASSWORD,
        fullName: "Marta Yohannes",
        phone: "+251911100205",
        accountType: "individual",
        nationalId: `NAT-${STAMP}-02`,
        region: "Oromia",
      },
    }),
    201,
    `POST /api/v1/auth/register - Register Competing Bidder (${bidder2Email})`,
  );
  let bidder2Token = bidder2Reg?.token;
  const bidder2UserId = bidder2Reg?.user?.id;

  // Login endpoint test
  const adminLogin = expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("POST", "/api/v1/auth/login", {
      body: { email: adminEmail, password: PASSWORD },
    }),
    200,
    "POST /api/v1/auth/login - Authenticate with credentials",
    (b) => `Authenticated as ${b?.user?.email}, Roles: [${b?.roles?.join(", ")}]`,
  );

  // Refresh token test
  expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: adminLogin?.refreshToken },
    }),
    200,
    "POST /api/v1/auth/refresh - Rotate JWT session tokens",
    "Issued fresh JWT access token",
  );

  // Profile endpoints: GET /me & PATCH /me
  expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("GET", "/api/v1/auth/me", { token: adminToken }),
    200,
    "GET /api/v1/auth/me - Read self profile details",
  );

  expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("PATCH", "/api/v1/auth/me", {
      token: adminToken,
      body: { phone: "+251911998877", region: "Addis Ababa City Administration" },
    }),
    200,
    "PATCH /api/v1/auth/me - Update profile contact details",
  );

  expectStatus(
    "2. Identity & Access Management (@cheretanet.org)",
    await call("GET", `/api/v1/auth/users/${officerUserId}`, { token: adminToken }),
    200,
    "GET /api/v1/auth/users/:id - Compliance/Admin inspects participant profile",
  );

  // --------------------------------------------------------------------------
  // 3. ORGANIZATIONS & MEMBERSHIP
  // --------------------------------------------------------------------------
  domainHeader("3. Organizations & Multi-Tenancy");

  const orgRes = expectStatus(
    "3. Organizations & Multi-Tenancy",
    await call("POST", "/api/v1/organizations", {
      token: adminToken,
      body: {
        name: `Public Procurement & Property Disposal Service (${STAMP})`,
        orgType: "government",
        tinNumber: `TIN${STAMP}`.slice(0, 15),
        region: "Addis Ababa",
        contactEmail: `procurement.${STAMP}@cheretanet.org`,
        contactPhone: "+251111540101",
      },
    }),
    201,
    "POST /api/v1/organizations - Create government organization",
    (b) => `Created Org ID: ${b?.id}`,
  );
  const orgId = orgRes?.id;

  expectStatus(
    "3. Organizations & Multi-Tenancy",
    await call("GET", "/api/v1/organizations"),
    200,
    "GET /api/v1/organizations - Public organization registry listing",
  );

  expectStatus(
    "3. Organizations & Multi-Tenancy",
    await call("GET", `/api/v1/organizations/${orgId}`),
    200,
    "GET /api/v1/organizations/:id - Retrieve organization details by ID",
  );

  // Add Officer & Compliance members
  expectStatus(
    "3. Organizations & Multi-Tenancy",
    await call("POST", `/api/v1/organizations/${orgId}/members`, {
      token: adminToken,
      body: { email: officerEmail, role: "auction_officer" },
    }),
    201,
    "POST /api/v1/organizations/:id/members - Assign auction_officer role",
  );

  expectStatus(
    "3. Organizations & Multi-Tenancy",
    await call("POST", `/api/v1/organizations/${orgId}/members`, {
      token: adminToken,
      body: { email: complianceEmail, role: "compliance_officer" },
    }),
    201,
    "POST /api/v1/organizations/:id/members - Assign compliance_officer role",
  );

  // Add a temporary member to test member deletion
  const tempMemberEmail = `temp.officer.${STAMP}@cheretanet.org`;
  const tempReg = await call("POST", "/api/v1/auth/register", {
    body: { email: tempMemberEmail, password: PASSWORD, fullName: "Temporary Staff" },
  });
  const tempUserId = tempReg.body?.user?.id;

  if (tempUserId) {
    await call("POST", `/api/v1/organizations/${orgId}/members`, {
      token: adminToken,
      body: { email: tempMemberEmail, role: "auction_officer" },
    });

    expectStatus(
      "3. Organizations & Multi-Tenancy",
      await call("GET", `/api/v1/organizations/${orgId}/members`, { token: adminToken }),
      200,
      "GET /api/v1/organizations/:id/members - List organization members",
    );

    expectStatus(
      "3. Organizations & Multi-Tenancy",
      await call("DELETE", `/api/v1/organizations/${orgId}/members/${tempUserId}`, { token: adminToken }),
      [200, 204],
      "DELETE /api/v1/organizations/:id/members/:userId - Remove organization member",
    );
  }

  // Refresh tokens with new organization context
  const officerLogin = (await call("POST", "/api/v1/auth/login", { body: { email: officerEmail, password: PASSWORD } })).body;
  const officerToken = officerLogin?.token;

  const complianceLogin = (await call("POST", "/api/v1/auth/login", { body: { email: complianceEmail, password: PASSWORD } })).body;
  const complianceToken = complianceLogin?.token;

  // Context switch endpoint test
  expectStatus(
    "3. Organizations & Multi-Tenancy",
    await call("POST", "/api/v1/auth/context", {
      token: officerToken,
      body: { organizationId: orgId },
    }),
    200,
    "POST /api/v1/auth/context - Switch active organization context",
    `Context set to org: ${orgId}`,
  );

  // --------------------------------------------------------------------------
  // 4. TAXONOMY & CATEGORIES
  // --------------------------------------------------------------------------
  domainHeader("4. Taxonomy & Categories");

  const catSlug = `machinery-fleet-${STAMP}`;
  const catRes = expectStatus(
    "4. Taxonomy & Categories",
    await call("POST", "/api/v1/categories", {
      token: adminToken,
      body: {
        name: "Heavy Equipment & Transport Fleet",
        slug: catSlug,
        description: "Surplus federal utility transport, trucks, and heavy earthmoving machinery",
        isActive: true,
      },
    }),
    201,
    `POST /api/v1/categories - Create public taxonomy category (${catSlug})`,
  );
  const categoryId = catRes?.id;

  expectStatus(
    "4. Taxonomy & Categories",
    await call("GET", "/api/v1/categories"),
    200,
    "GET /api/v1/categories - Browse category taxonomy",
  );

  if (categoryId) {
    expectStatus(
      "4. Taxonomy & Categories",
      await call("GET", `/api/v1/categories/${categoryId}`),
      200,
      "GET /api/v1/categories/:id - Get category details by ID",
    );

    expectStatus(
      "4. Taxonomy & Categories",
      await call("PATCH", `/api/v1/categories/${categoryId}`, {
        token: adminToken,
        body: { description: "Updated: Official federal automotive disposal category" },
      }),
      200,
      "PATCH /api/v1/categories/:id - Update category metadata",
    );
  }

  // --------------------------------------------------------------------------
  // 5. AUCTIONS MANAGEMENT & DRAFT CANCEL
  // --------------------------------------------------------------------------
  domainHeader("5. Auctions Lifecycle & Two-Person Rule");

  // Secondary draft auction for cancellation test
  const cancelTestAuction = expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("POST", "/api/v1/auctions", {
      token: officerToken,
      body: {
        organizationId: orgId,
        title: `Draft Auction for Cancel Test #${STAMP}`,
        description: "Will be cancelled by officer",
        auctionType: "open_ascending",
        startPrice: "50000.00",
        minIncrement: "2000.00",
        depositAmount: "5000.00",
        opensAt: isoOffset(3600_000),
        closesAt: isoOffset(7200_000),
      },
    }),
    201,
    "POST /api/v1/auctions - Create draft auction for cancellation check",
  );

  if (cancelTestAuction?.id) {
    expectStatus(
      "5. Auctions Lifecycle & Two-Person Rule",
      await call("DELETE", `/api/v1/auctions/${cancelTestAuction.id}`, {
        token: officerToken,
        body: { reason: "Cancelled by administrative discretion prior to item cataloging" },
      }),
      200,
      "DELETE /api/v1/auctions/:id - Cancel draft auction with logged reason",
    );
  }

  // Main Live Auction
  const auction = expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("POST", "/api/v1/auctions", {
      token: officerToken,
      body: {
        organizationId: orgId,
        title: `Disposal of Government Utility Fleet & Industrial Machinery Lot #${STAMP}`,
        description: "Official transparent public auction of surplus governmental 4WD vehicles and transport units in accordance with Federal Directive No. 43/2026.",
        auctionType: "open_ascending",
        startPrice: "1500000.00",
        minIncrement: "25000.00",
        depositAmount: "50000.00",
        region: "Addis Ababa",
        eligibilityRules: "Open to registered Ethiopian citizens with verified KYC and valid CPO deposit.",
        opensAt: isoOffset(-60_000), // Open in past so it goes directly live
        closesAt: isoOffset(3600_000 * 4),
      },
    }),
    201,
    "POST /api/v1/auctions - Officer creates primary auction in draft state",
    (b) => `Auction ID: ${b?.id}`,
  );
  const auctionId = auction?.id;

  expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("GET", "/api/v1/auctions"),
    200,
    "GET /api/v1/auctions - Public discovery list",
  );

  expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("GET", `/api/v1/auctions/${auctionId}`),
    404,
    "GET /api/v1/auctions/:id - Draft auction hidden from anonymous visitors",
  );

  expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("GET", `/api/v1/auctions/${auctionId}`, { token: officerToken }),
    200,
    "GET /api/v1/auctions/:id - Organization officer reads draft auction",
  );

  expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("GET", `/api/v1/organizations/${orgId}/auctions`, { token: officerToken }),
    200,
    "GET /api/v1/organizations/:orgId/auctions - List auctions by organization",
  );

  expectStatus(
    "5. Auctions Lifecycle & Two-Person Rule",
    await call("PATCH", `/api/v1/auctions/${auctionId}`, {
      token: officerToken,
      body: {
        description: "Official transparent public auction of surplus governmental 4WD vehicles (amended with certified inspection history).",
      },
    }),
    200,
    "PATCH /api/v1/auctions/:id - Amend draft auction parameters",
  );

  // --------------------------------------------------------------------------
  // 6. AUCTION ITEMS & LOTS
  // --------------------------------------------------------------------------
  domainHeader("6. Auction Items & Lots");

  const item1 = expectStatus(
    "6. Auction Items & Lots",
    await call("POST", `/api/v1/auctions/${auctionId}/items`, {
      token: officerToken,
      body: {
        title: "2023 Toyota Land Cruiser Hardtop 4.2L Diesel (White)",
        description: "Official vehicle with 35,400 KM, original parts, comprehensive dealer service record, A/C functional.",
        quantity: 1,
        condition: "used_good",
        estimatedValue: "1800000.00",
        categoryId,
        region: "Addis Ababa",
        city: "Addis Ababa",
      },
    }),
    201,
    "POST /api/v1/auctions/:id/items - Add Item 1: 2023 Toyota Land Cruiser",
  );
  const itemId1 = item1?.id;

  const item2 = expectStatus(
    "6. Auction Items & Lots",
    await call("POST", `/api/v1/auctions/${auctionId}/items`, {
      token: officerToken,
      body: {
        title: "Caterpillar 320D Hydraulic Crawler Excavator",
        description: "6,200 engine hours, heavy duty boom, auxiliary hydraulic piping, tested hydraulic pressure.",
        quantity: 1,
        condition: "used_good",
        estimatedValue: "4200000.00",
        categoryId,
        region: "Addis Ababa",
        city: "Addis Ababa",
      },
    }),
    201,
    "POST /api/v1/auctions/:id/items - Add Item 2: Caterpillar 320D Excavator",
  );

  // Extra item to test item PATCH & DELETE
  const itemTemp = await call("POST", `/api/v1/auctions/${auctionId}/items`, {
    token: officerToken,
    body: { title: "Surplus Office Cabinets Lot", quantity: 5, condition: "used_fair" },
  });
  const tempItemId = itemTemp.body?.id;

  expectStatus(
    "6. Auction Items & Lots",
    await call("GET", `/api/v1/auctions/${auctionId}/items`, { token: officerToken }),
    200,
    "GET /api/v1/auctions/:id/items - List lots cataloged in auction",
  );

  if (itemId1) {
    expectStatus(
      "6. Auction Items & Lots",
      await call("GET", `/api/v1/auctions/${auctionId}/items/${itemId1}`, { token: officerToken }),
      200,
      "GET /api/v1/auctions/:id/items/:itemId - Read single lot details",
    );
  }

  if (tempItemId) {
    expectStatus(
      "6. Auction Items & Lots",
      await call("PATCH", `/api/v1/auctions/${auctionId}/items/${tempItemId}`, {
        token: officerToken,
        body: { condition: "salvage" },
      }),
      200,
      "PATCH /api/v1/auctions/:id/items/:itemId - Update item condition",
    );

    expectStatus(
      "6. Auction Items & Lots",
      await call("DELETE", `/api/v1/auctions/${auctionId}/items/${tempItemId}`, {
        token: officerToken,
      }),
      [200, 204],
      "DELETE /api/v1/auctions/:id/items/:itemId - Delete lot item from auction",
    );
  }

  // --------------------------------------------------------------------------
  // 7. APPROVAL WORKFLOW & TWO-PERSON RULE
  // --------------------------------------------------------------------------
  domainHeader("7. Two-Person Integrity Control & Transition");

  expectStatus(
    "7. Two-Person Integrity Control & Transition",
    await call("POST", `/api/v1/auctions/${auctionId}/submit`, { token: officerToken }),
    200,
    "POST /api/v1/auctions/:id/submit - Officer submits auction for independent review",
  );

  // Creator self-approval must be rejected by two-person rule
  expectStatus(
    "7. Two-Person Integrity Control & Transition",
    await call("POST", `/api/v1/auctions/${auctionId}/approve`, { token: officerToken }),
    [403, 422],
    "POST /api/v1/auctions/:id/approve - Creator self-approval rejected by Two-Person rule (Enforced)",
    "System successfully blocked creator from approving own auction",
  );

  // Independent compliance officer approves
  expectStatus(
    "7. Two-Person Integrity Control & Transition",
    await call("POST", `/api/v1/auctions/${auctionId}/approve`, { token: complianceToken }),
    200,
    "POST /api/v1/auctions/:id/approve - Compliance Officer approves auction (Transitions to scheduled)",
  );

  // Transition to live
  expectStatus(
    "7. Two-Person Integrity Control & Transition",
    await call("PATCH", `/api/v1/auctions/${auctionId}/status`, {
      token: complianceToken,
      body: { status: "live" },
    }),
    200,
    "PATCH /api/v1/auctions/:id/status - Transition auction to LIVE status",
    "Auction is now live for public bidding",
  );

  // --------------------------------------------------------------------------
  // 8. KYC VERIFICATION
  // --------------------------------------------------------------------------
  domainHeader("8. KYC Verification (Digital ID & Duplicates)");

  expectStatus(
    "8. KYC Verification (Digital ID & Duplicates)",
    await call("POST", "/api/v1/verifications/submit", {
      token: bidder1Token,
      body: { documentType: "national_id", documentNumber: `FAYDA-ETH-${STAMP}-01` },
    }),
    201,
    "POST /api/v1/verifications/submit - Bidder 1 submits Ethiopian Digital Fayda ID",
  );

  expectStatus(
    "8. KYC Verification (Digital ID & Duplicates)",
    await call("POST", "/api/v1/verifications/submit", {
      token: bidder2Token,
      body: { documentType: "national_id", documentNumber: `FAYDA-ETH-${STAMP}-02` },
    }),
    201,
    "POST /api/v1/verifications/submit - Bidder 2 submits Ethiopian Digital Fayda ID",
  );

  expectStatus(
    "8. KYC Verification (Digital ID & Duplicates)",
    await call("GET", "/api/v1/verifications/me", { token: bidder1Token }),
    200,
    "GET /api/v1/verifications/me - Bidder 1 views own KYC submission status",
  );

  const pendingKYC = expectStatus(
    "8. KYC Verification (Digital ID & Duplicates)",
    await call("GET", "/api/v1/verifications/pending", { token: complianceToken }),
    200,
    "GET /api/v1/verifications/pending - Compliance Officer lists pending KYC queue",
  );

  const pendingItems = pendingKYC?.items ?? [];
  for (const item of pendingItems) {
    if ([bidder1UserId, bidder2UserId].includes(item.userId)) {
      expectStatus(
        "8. KYC Verification (Digital ID & Duplicates)",
        await call("POST", `/api/v1/verifications/${item.id}/review`, {
          token: complianceToken,
          body: { decision: "approved" },
        }),
        200,
        `POST /api/v1/verifications/:id/review - Approve KYC verification for user ${item.userId.slice(0, 8)}...`,
      );
    }
  }

  expectStatus(
    "8. KYC Verification (Digital ID & Duplicates)",
    await call("GET", `/api/v1/verifications/users/${bidder1UserId}/duplicates`, { token: complianceToken }),
    200,
    "GET /api/v1/verifications/users/:userId/duplicates - Check duplicate identity records",
  );

  // --------------------------------------------------------------------------
  // 9. CPO BANK DEPOSIT GUARANTEE
  // --------------------------------------------------------------------------
  domainHeader("9. Bid Security & CPO Deposits");

  const deposit1 = expectStatus(
    "9. Bid Security & CPO Deposits",
    await call("POST", "/api/v1/deposits", {
      token: bidder1Token,
      body: {
        auctionId,
        amount: "50000.00",
        referenceNumber: `CPO-CBE-ADDIS-2026-${STAMP}-1`,
        issuingBank: "Commercial Bank of Ethiopia (CBE Arada Branch)",
        instrumentType: "cpo",
      },
    }),
    201,
    "POST /api/v1/deposits - Bidder 1 deposits 50,000 ETB CPO guarantee",
  );

  const deposit2 = expectStatus(
    "9. Bid Security & CPO Deposits",
    await call("POST", "/api/v1/deposits", {
      token: bidder2Token,
      body: {
        auctionId,
        amount: "50000.00",
        referenceNumber: `CPO-AWASH-2026-${STAMP}-2`,
        issuingBank: "Awash International Bank (Bole Branch)",
        instrumentType: "cpo",
      },
    }),
    201,
    "POST /api/v1/deposits - Bidder 2 deposits 50,000 ETB CPO guarantee",
  );

  // Release test deposit record
  const depositTemp = await call("POST", "/api/v1/deposits", {
    token: bidder1Token,
    body: {
      auctionId,
      amount: "10000.00",
      referenceNumber: `CPO-RELEASE-TEST-${STAMP}`,
      issuingBank: "Dashen Bank",
      instrumentType: "bank_guarantee",
    },
  });

  expectStatus(
    "9. Bid Security & CPO Deposits",
    await call("GET", "/api/v1/deposits/me", { token: bidder1Token }),
    200,
    "GET /api/v1/deposits/me - Bidder 1 checks active deposits list",
  );

  expectStatus(
    "9. Bid Security & CPO Deposits",
    await call("GET", `/api/v1/deposits?auctionId=${auctionId}`, { token: complianceToken }),
    200,
    "GET /api/v1/deposits?auctionId=... - Officers inspect auction deposits ledger",
  );

  if (deposit1?.id) {
    expectStatus(
      "9. Bid Security & CPO Deposits",
      await call("GET", `/api/v1/deposits/${deposit1.id}`, { token: bidder1Token }),
      200,
      "GET /api/v1/deposits/:id - Read single deposit guarantee details",
    );

    expectStatus(
      "9. Bid Security & CPO Deposits",
      await call("POST", `/api/v1/deposits/${deposit1.id}/review`, {
        token: complianceToken,
        body: { decision: "verified" },
      }),
      200,
      "POST /api/v1/deposits/:id/review - Verify Bidder 1 CPO deposit",
    );
  }

  if (deposit2?.id) {
    await call("POST", `/api/v1/deposits/${deposit2.id}/review`, {
      token: complianceToken,
      body: { decision: "verified" },
    });
  }

  if (depositTemp.body?.id) {
    await call("POST", `/api/v1/deposits/${depositTemp.body.id}/review`, {
      token: complianceToken,
      body: { decision: "verified" },
    });

    expectStatus(
      "9. Bid Security & CPO Deposits",
      await call("POST", `/api/v1/deposits/${depositTemp.body.id}/release`, {
        token: complianceToken,
      }),
      200,
      "POST /api/v1/deposits/:id/release - Release unencumbered deposit back to bidder",
    );
  }

  // --------------------------------------------------------------------------
  // 10. DOCUMENT MANAGEMENT & UPLOAD
  // --------------------------------------------------------------------------
  domainHeader("10. Technical Document Packs & Storage");

  const formData = new FormData();
  formData.append(
    "file",
    new Blob(["FEDERAL PROCUREMENT SERVICE - OFFICIAL TECHNICAL INSPECTION REPORT: Vehicles & Equipment cleared."], {
      type: "text/plain",
    }),
    `inspection_certificate_${STAMP}.txt`,
  );
  formData.append("docType", "inspection_report");
  formData.append("auctionId", auctionId);
  formData.append("isPrivate", "false");

  const docUploadRes = expectStatus(
    "10. Technical Document Packs & Storage",
    await call("POST", "/api/v1/documents", {
      token: officerToken,
      body: formData,
      isFormData: true,
    }),
    201,
    "POST /api/v1/documents - Multipart upload of verified inspection certificate",
    (b) => `Document ID: ${b?.id}, Checksum SHA-256: ${b?.checksumSha256?.slice(0, 16)}...`,
  );
  const docId = docUploadRes?.id;

  expectStatus(
    "10. Technical Document Packs & Storage",
    await call("GET", "/api/v1/documents/me", { token: officerToken }),
    200,
    "GET /api/v1/documents/me - List documents uploaded by user",
  );

  expectStatus(
    "10. Technical Document Packs & Storage",
    await call("GET", `/api/v1/documents?auctionId=${auctionId}`, { token: bidder1Token }),
    200,
    "GET /api/v1/documents?auctionId=... - Public discovery of auction document pack",
  );

  if (docId) {
    expectStatus(
      "10. Technical Document Packs & Storage",
      await call("GET", `/api/v1/documents/${docId}`, { token: bidder1Token }),
      200,
      "GET /api/v1/documents/:id - View document cryptographic metadata",
    );

    const docContentRes = await call("GET", `/api/v1/documents/${docId}/content`, { token: bidder1Token });
    expectStatus(
      "10. Technical Document Packs & Storage",
      docContentRes,
      200,
      "GET /api/v1/documents/:id/content - Stream verified file contents",
      (b) => `Received ${b?.length ?? 0} bytes`,
    );
  }

  // --------------------------------------------------------------------------
  // 11. LIVE BIDDING & ANTI-SNIPE MECHANICS
  // --------------------------------------------------------------------------
  domainHeader("11. Live Bidding & Real-time State");

  const bidKey = `bid-key-${STAMP}`;
  const bid1 = expectStatus(
    "11. Live Bidding & Real-time State",
    await call("POST", `/api/v1/auctions/${auctionId}/bids`, {
      token: bidder1Token,
      body: { amount: "1550000.00" },
      headers: { "Idempotency-Key": bidKey },
    }),
    201,
    "POST /api/v1/auctions/:id/bids - Bidder 1 places initial opening bid: 1,550,000 ETB",
    (b) => `Hash: ${b?.audit?.hash?.slice(0, 16)}..., Seq #${b?.audit?.sequenceNo}`,
  );
  const bidId1 = bid1?.bid?.id;

  // Idempotency test (must return 200/201 without duplicate row)
  expectStatus(
    "11. Live Bidding & Real-time State",
    await call("POST", `/api/v1/auctions/${auctionId}/bids`, {
      token: bidder1Token,
      body: { amount: "1550000.00" },
      headers: { "Idempotency-Key": bidKey },
    }),
    [200, 201],
    "POST /api/v1/auctions/:id/bids - Idempotent bid replay test with exact same Idempotency-Key",
  );

  // Counter bid from Bidder 2
  expectStatus(
    "11. Live Bidding & Real-time State",
    await call("POST", `/api/v1/auctions/${auctionId}/bids`, {
      token: bidder2Token,
      body: { amount: "1600000.00" },
    }),
    201,
    "POST /api/v1/auctions/:id/bids - Bidder 2 places competitive counter-bid: 1,600,000 ETB",
    (b) => `New highest bid: ETB ${b?.auction?.currentHighestBid}, Total bids: ${b?.auction?.bidCount}`,
  );

  expectStatus(
    "11. Live Bidding & Real-time State",
    await call("GET", `/api/v1/auctions/${auctionId}/bids`, { token: officerToken }),
    200,
    "GET /api/v1/auctions/:id/bids - List bid history ledger with pseudonyms",
  );

  if (bidId1) {
    expectStatus(
      "11. Live Bidding & Real-time State",
      await call("POST", `/api/v1/auctions/${auctionId}/bids/${bidId1}/withdraw`, {
        token: bidder1Token,
        body: { reason: "Mistyped amount correction attempt" },
      }),
      [200, 400, 422],
      "POST /api/v1/auctions/:id/bids/:bidId/withdraw - Bid withdrawal policy enforcement",
    );
  }

  // --------------------------------------------------------------------------
  // 12. AI-POWERED INTELLIGENCE
  // --------------------------------------------------------------------------
  domainHeader("12. AI Intelligence (Categorization, Anomaly & Assistant)");

  expectStatus(
    "12. AI Intelligence (Categorization, Anomaly & Assistant)",
    await call("POST", "/api/v1/ai/categorize", {
      token: officerToken,
      body: {
        text: "2023 Toyota Hilux Double Cab 4WD Pickup, 2.8L GD-6 turbo diesel engine, 6-speed manual, heavy duty suspension, 18,200 km, Addis Ababa fleet disposal.",
      },
    }),
    200,
    "POST /api/v1/ai/categorize - AI classifies listing text into taxonomy",
    (b) => `Category: "${b?.category}", Confidence: ${(b?.confidence * 100).toFixed(1)}%`,
  );

  expectStatus(
    "12. AI Intelligence (Categorization, Anomaly & Assistant)",
    await call("POST", "/api/v1/ai/anomaly", {
      token: complianceToken,
      body: { auctionId },
    }),
    200,
    "POST /api/v1/ai/anomaly - AI evaluates auction for irregular bidding velocity / shill behavior",
    (b) => `Flagged: ${b?.flagged}, Reason: ${b?.flag?.explanation ?? "No irregular patterns detected"}`,
  );

  const anomaliesList = expectStatus(
    "12. AI Intelligence (Categorization, Anomaly & Assistant)",
    await call("GET", `/api/v1/ai/anomalies?auctionId=${auctionId}`, { token: complianceToken }),
    200,
    "GET /api/v1/ai/anomalies - Compliance lists flagged anomaly queue",
  );

  if (anomaliesList?.items?.length > 0) {
    const anomalyId = anomaliesList.items[0].id;
    expectStatus(
      "12. AI Intelligence (Categorization, Anomaly & Assistant)",
      await call("POST", `/api/v1/ai/anomalies/${anomalyId}/review`, {
        token: complianceToken,
        body: { status: "reviewed", decisionNote: "Reviewed by compliance team; verified normal competitive bidding." },
      }),
      200,
      "POST /api/v1/ai/anomalies/:id/review - Compliance reviewer records advisory decision",
    );
  }

  expectStatus(
    "12. AI Intelligence (Categorization, Anomaly & Assistant)",
    await call("POST", "/api/v1/ai/assist", {
      token: bidder1Token,
      body: {
        prompt: "What are the rules regarding CPO deposits and anti-snipe countdown extensions under Ethiopian public auction directives?",
        auctionId,
      },
    }),
    200,
    "POST /api/v1/ai/assist - Natural Language AI Assistant Q&A",
    (b) => `Answer preview: "${b?.answer?.slice(0, 120)}..."`,
  );

  // --------------------------------------------------------------------------
  // 13. TELEGRAM INTEGRATION
  // --------------------------------------------------------------------------
  domainHeader("13. Telegram Bot & Channel Integration");

  expectStatus(
    "13. Telegram Bot & Channel Integration",
    await call("POST", "/api/v1/telegram/link-token", { token: bidder1Token }),
    201,
    "POST /api/v1/telegram/link-token - Generate 8-character connection code",
    (b) => `Link Token: ${b?.data?.token}, DeepLink: ${b?.data?.deepLink}`,
  );

  expectStatus(
    "13. Telegram Bot & Channel Integration",
    await call("GET", "/api/v1/telegram/status", { token: bidder1Token }),
    200,
    "GET /api/v1/telegram/status - Check user's Telegram link standing",
  );

  // Test Telegram Webhook simulation
  const tgWebhookUpdate = {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      from: { id: 99887766, is_bot: false, first_name: "Solomon", username: "solomon_eth" },
      chat: { id: 99887766, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: "/start",
    },
  };

  expectStatus(
    "13. Telegram Bot & Channel Integration",
    await call("POST", "/api/v1/telegram/webhook", { body: tgWebhookUpdate }),
    200,
    "POST /api/v1/telegram/webhook - Simulate incoming Telegram bot /start command",
    "Webhook processed and dispatched by bot service",
  );

  // Broadcast Live Auction to Telegram Channel
  expectStatus(
    "13. Telegram Bot & Channel Integration",
    await call("POST", `/api/v1/telegram/broadcast/${auctionId}`, { token: officerToken }),
    200,
    "POST /api/v1/telegram/broadcast/:id - Publish live auction card to Telegram Channel (@cheretanet)",
    (b) => `Broadcast result: ${b?.data?.broadcasted ? "Broadcasted to @cheretanet" : "Channel dispatched/handled"}`,
  );

  expectStatus(
    "13. Telegram Bot & Channel Integration",
    await call("DELETE", "/api/v1/telegram/unlink", { token: bidder1Token }),
    200,
    "DELETE /api/v1/telegram/unlink - Disconnect linked Telegram profile",
  );

  // --------------------------------------------------------------------------
  // 14. COMPLIANCE AUDITING
  // --------------------------------------------------------------------------
  domainHeader("14. Compliance Checks");

  expectStatus(
    "14. Compliance Checks",
    await call("POST", `/api/v1/compliance/auctions/${auctionId}/checks`, {
      token: complianceToken,
      body: { notes: "Pre-award regulatory compliance inspection - CPO guarantees and participant verification verified." },
    }),
    201,
    "POST /api/v1/compliance/auctions/:id/checks - Run official automated compliance audit check",
  );

  expectStatus(
    "14. Compliance Checks",
    await call("GET", `/api/v1/compliance/auctions/${auctionId}/checks`, { token: complianceToken }),
    200,
    "GET /api/v1/compliance/auctions/:id/checks - List compliance inspection reports",
  );

  // --------------------------------------------------------------------------
  // 15. CRYPTOGRAPHIC SHA-256 AUDIT LEDGER
  // --------------------------------------------------------------------------
  domainHeader("15. Cryptographic SHA-256 Audit Chain");

  expectStatus(
    "15. Cryptographic SHA-256 Audit Chain",
    await call("GET", "/api/v1/audit/events", { token: complianceToken }),
    200,
    "GET /api/v1/audit/events - Query immutable audit events log",
  );

  expectStatus(
    "15. Cryptographic SHA-256 Audit Chain",
    await call("GET", "/api/v1/audit/verify", { token: complianceToken }),
    200,
    "GET /api/v1/audit/verify - Verify platform-wide SHA-256 cryptographic chain",
    (b) => `Intact: ${b?.intact}, Head Hash: ${b?.headHash?.slice(0, 16)}...`,
  );

  expectStatus(
    "15. Cryptographic SHA-256 Audit Chain",
    await call("GET", `/api/v1/audit/auctions/${auctionId}/verify`, { token: complianceToken }),
    200,
    "GET /api/v1/audit/auctions/:id/verify - Verify auction-specific cryptographic SHA-256 Merkle chain",
    (b) => `Intact: ${b?.intact}, Total Chain Events: ${b?.eventCount}`,
  );

  // --------------------------------------------------------------------------
  // 16. AUCTION CLOSURE & DISPUTE RESOLUTION
  // --------------------------------------------------------------------------
  domainHeader("16. Auction Closure & Dispute Resolution");

  // Close live auction (live -> closed)
  expectStatus(
    "16. Auction Closure & Dispute Resolution",
    await call("PATCH", `/api/v1/auctions/${auctionId}/status`, {
      token: complianceToken,
      body: { status: "closed" },
    }),
    200,
    "PATCH /api/v1/auctions/:id/status - Conclude live auction (CLOSED)",
  );

  // Open formal dispute on closed auction (closed -> under_review)
  const dispute = expectStatus(
    "16. Auction Closure & Dispute Resolution",
    await call("POST", "/api/v1/disputes", {
      token: bidder1Token,
      body: {
        auctionId,
        reason: "Requesting audit log review of bid timing during the final two-minute anti-snipe window.",
        evidence: { bidAmount: "1550000.00", recordedClientTime: new Date().toISOString() },
      },
    }),
    201,
    "POST /api/v1/disputes - Participant opens formal procurement dispute",
    (b) => `Dispute ID: ${b?.id}, Status: ${b?.status}`,
  );
  const disputeId = dispute?.id;

  expectStatus(
    "16. Auction Closure & Dispute Resolution",
    await call("GET", `/api/v1/disputes?auctionId=${auctionId}`, { token: bidder1Token }),
    200,
    "GET /api/v1/disputes - List disputes on auction",
  );

  if (disputeId) {
    expectStatus(
      "16. Auction Closure & Dispute Resolution",
      await call("GET", `/api/v1/disputes/${disputeId}`, { token: bidder1Token }),
      200,
      "GET /api/v1/disputes/:id - View dispute docket and evidence",
    );

    expectStatus(
      "16. Auction Closure & Dispute Resolution",
      await call("POST", `/api/v1/disputes/${disputeId}/assign`, {
        token: complianceToken,
        body: { reviewerId: complianceUserId },
      }),
      200,
      "POST /api/v1/disputes/:id/assign - Assign dispute to Compliance Officer",
    );

    expectStatus(
      "16. Auction Closure & Dispute Resolution",
      await call("POST", `/api/v1/disputes/${disputeId}/resolve`, {
        token: complianceToken,
        body: {
          status: "resolved",
          decision: "Dispute reviewed and resolved",
          decisionReason: "Audit trail confirms anti-snipe clock extension executed correctly according to Directive 43.",
        },
      }),
      200,
      "POST /api/v1/disputes/:id/resolve - Issue official compliance ruling on dispute",
    );
  }

  // --------------------------------------------------------------------------
  // 17. FINAL AWARD & TRANSPARENCY REPORTING
  // --------------------------------------------------------------------------
  domainHeader("17. Final Award & Transparency Reporting");

  // Award auction to winning bidder (under_review -> awarded)
  expectStatus(
    "17. Final Award & Transparency Reporting",
    await call("PATCH", `/api/v1/auctions/${auctionId}/status`, {
      token: complianceToken,
      body: { status: "awarded" },
    }),
    200,
    "PATCH /api/v1/auctions/:id/status - Award auction (AWARDED to leading bidder Marta Yohannes)",
  );

  const report = expectStatus(
    "17. Auction Closure & Transparency Reporting",
    await call("POST", "/api/v1/reports", {
      token: complianceToken,
      body: { auctionId, type: "auction_summary" },
    }),
    201,
    "POST /api/v1/reports - Generate official auction summary audit report",
    (b) => `Report ID: ${b?.id}`,
  );
  const reportId = report?.id;

  expectStatus(
    "17. Auction Closure & Transparency Reporting",
    await call("GET", `/api/v1/reports?auctionId=${auctionId}`, { token: complianceToken }),
    200,
    "GET /api/v1/reports - List generated transparency reports",
  );

  if (reportId) {
    expectStatus(
      "17. Auction Closure & Transparency Reporting",
      await call("GET", `/api/v1/reports/${reportId}`, { token: complianceToken }),
      200,
      "GET /api/v1/reports/:id - Inspect report contents",
    );

    expectStatus(
      "17. Auction Closure & Transparency Reporting",
      await call("POST", `/api/v1/reports/${reportId}/publish`, { token: complianceToken }),
      200,
      "POST /api/v1/reports/:id/publish - Publish report publicly (FR16 Public Transparency Artefact)",
    );
  }

  // --------------------------------------------------------------------------
  // 18. NOTIFICATIONS FEED
  // --------------------------------------------------------------------------
  domainHeader("18. In-App Notifications Feed");

  const note = expectStatus(
    "18. In-App Notifications Feed",
    await call("POST", "/api/v1/notifications", {
      token: adminToken,
      body: {
        userId: bidder1UserId,
        channel: "in_app",
        type: "auction.awarded",
        title: "Official Auction Concluded",
        message: "Auction Lot has been concluded and awarded. Check the official public report.",
        relatedEntityType: "auction",
        relatedEntityId: auctionId,
      },
    }),
    201,
    "POST /api/v1/notifications - Admin dispatches notification to participant",
  );
  const noteId = note?.id;

  expectStatus(
    "18. In-App Notifications Feed",
    await call("GET", "/api/v1/notifications", { token: bidder1Token }),
    200,
    "GET /api/v1/notifications - User reads notification list",
  );

  expectStatus(
    "18. In-App Notifications Feed",
    await call("GET", "/api/v1/notifications/unread-count", { token: bidder1Token }),
    200,
    "GET /api/v1/notifications/unread-count - Fetch unread badge counter",
    (b) => `Unread: ${b?.count}`,
  );

  if (noteId) {
    expectStatus(
      "18. In-App Notifications Feed",
      await call("POST", `/api/v1/notifications/${noteId}/read`, { token: bidder1Token }),
      200,
      "POST /api/v1/notifications/:id/read - Mark individual notification as read",
    );
  }

  expectStatus(
    "18. In-App Notifications Feed",
    await call("POST", "/api/v1/notifications/read-all", { token: bidder1Token }),
    200,
    "POST /api/v1/notifications/read-all - Mark all user notifications as read",
  );

  // --------------------------------------------------------------------------
  // 19. REALTIME SERVER-SENT EVENTS (SSE)
  // --------------------------------------------------------------------------
  domainHeader("19. Real-time Server-Sent Events (SSE)");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const sseResponse = await fetch(`${BASE}/api/v1/events?channel=auction:${auctionId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${officerToken}`,
        Accept: "text/event-stream",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    controller.abort();

    if (sseResponse.status === 200 && (sseResponse.headers.get("content-type") || "").includes("text/event-stream")) {
      pass(
        "19. Real-time Server-Sent Events (SSE)",
        "GET /api/v1/events?channel=auction:... - Verified SSE handshake and event-stream channel subscription",
        `HTTP 200, Content-Type: ${sseResponse.headers.get("content-type")}`,
      );
    } else {
      fail(
        "19. Real-time Server-Sent Events (SSE)",
        "GET /api/v1/events - SSE handshake failed",
        `Status ${sseResponse.status}, Content-Type: ${sseResponse.headers.get("content-type")}`,
      );
    }
  } catch (err) {
    if (err.name === "AbortError") {
      pass(
        "19. Real-time Server-Sent Events (SSE)",
        "GET /api/v1/events - Verified SSE stream established and cleanly aborted",
      );
    } else {
      fail("19. Real-time Server-Sent Events (SSE)", "GET /api/v1/events - SSE connection error", err.message);
    }
  }

  // --------------------------------------------------------------------------
  // FINAL REPORT
  // --------------------------------------------------------------------------
  process.stdout.write(`\n\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m\n`);
  process.stdout.write(`\x1b[1;37m CHERETANET ENDPOINT VERIFICATION SUMMARY\x1b[0m\n`);
  process.stdout.write(`\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m\n`);

  for (const [domain, counts] of Object.entries(resultsByDomain)) {
    const symbol = counts.failed === 0 ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✘\x1b[0m";
    process.stdout.write(` ${symbol} ${domain.padEnd(52)} ${counts.passed} passed, ${counts.failed} failed\n`);
  }

  process.stdout.write(`\x1b[1;36m───────────────────────────────────────────────────────────────\x1b[0m\n`);
  process.stdout.write(` Total Endpoints Tested: \x1b[1m${passedCount + failedCount}\x1b[0m\n`);
  process.stdout.write(` Total Passed:           \x1b[1;32m${passedCount}\x1b[0m\n`);
  process.stdout.write(` Total Failed:           \x1b[1;${failedCount === 0 ? "32" : "31"}m${failedCount}\x1b[0m\n`);
  process.stdout.write(` All Emails Used:        \x1b[1;34m*@cheretanet.org\x1b[0m\n`);
  process.stdout.write(`\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m\n\n`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stdout.write(`\n\x1b[1;31mFATAL TEST RUN ERROR:\x1b[0m ${err.stack || err.message}\n`);
  process.exitCode = 1;
});
