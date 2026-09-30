const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const PASSWORD = "Admin@123";

let failures = 0;

function heading(text) {
  process.stdout.write(`\n\x1b[1m==> ${text}\x1b[0m\n`);
}

function pass(text) {
  process.stdout.write(`  \x1b[32m✓\x1b[0m ${text}\n`);
}

function fail(text, detail) {
  failures += 1;
  process.stdout.write(`  \x1b[31m✗\x1b[0m ${text}\n`);
  if (detail) process.stdout.write(`      ${detail}\n`);
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      // Bid placement requires this; harmless elsewhere.
      "Idempotency-Key": `smoke-${STAMP}-${Math.random().toString(36).slice(2)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, body: payload };
}

function describe(result) {
  return `HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 240)}`;
}

/** Asserts a status and returns the body, so each step reads as one line. */
function expect(result, expected, label) {
  const want = Array.isArray(expected) ? expected : [expected];
  if (want.includes(result.status)) {
    pass(label);
    return result.body;
  }
  fail(label, describe(result));
  return result.body;
}

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

async function main() {
  process.stdout.write(`Smoke run against ${BASE}\n`);

  heading("health");
  expect(await call("GET", "/health"), 200, "GET /health");

  heading("platform admin bootstrap");
  const adminEmail = `admin@cheretanet.org`;
  const admin = expect(
    await call("POST", "/api/v1/auth/register", {
      body: { email: adminEmail, password: PASSWORD, fullName: "Platform Admin" },
    }),
    201,
    "register platform admin",
  );
  const adminToken = admin?.token;
  if (!adminToken) {
    fail("admin token missing — cannot continue");
    return;
  }
  if (admin.roles?.includes("super_admin")) {
    pass("admin was promoted to super_admin");
  } else {
    fail(
      "admin is not super_admin",
      "Set BOOTSTRAP_SUPER_ADMIN_EMAIL, or run against a database with no profiles yet.",
    );
  }

  heading("organization");
  const org = expect(
    await call("POST", "/api/v1/organizations", {
      token: adminToken,
      body: {
        name: `Smoke Org ${STAMP}`,
        orgType: "government",
        tinNumber: `TIN${STAMP}`.slice(0, 20),
        region: "Addis Ababa",
        contactEmail: `ops+${STAMP}@example.com`,
        contactPhone: "+251911000000",
      },
    }),
    201,
    "create organization",
  );
  const orgId = org?.id;
  if (!orgId) return;

  heading("members");
  const officerEmail = `officer+${STAMP}@example.com`;
  const approverEmail = `approver+${STAMP}@example.com`;
  const bidderEmail = `bidder+${STAMP}@example.com`;

  for (const [email, name] of [
    [officerEmail, "Auction Officer"],
    [approverEmail, "Compliance Officer"],
    [bidderEmail, "Bidder"],
  ]) {
    expect(
      await call("POST", "/api/v1/auth/register", {
        body: { email, password: PASSWORD, fullName: name },
      }),
      201,
      `register ${name}`,
    );
  }

  expect(
    await call("POST", `/api/v1/organizations/${orgId}/members`, {
      token: adminToken,
      body: { email: officerEmail, role: "auction_officer" },
    }),
    201,
    "grant auction_officer",
  );
  expect(
    await call("POST", `/api/v1/organizations/${orgId}/members`, {
      token: adminToken,
      body: { email: approverEmail, role: "compliance_officer" },
    }),
    201,
    "grant compliance_officer",
  );

  // Roles are carried in the token, so a fresh login is required after a grant.
  const login = async (email) =>
    (await call("POST", "/api/v1/auth/login", { body: { email, password: PASSWORD } })).body;

  const officer = await login(officerEmail);
  const approver = await login(approverEmail);
  const bidder = await login(bidderEmail);

  if (officer?.organizationId === orgId) {
    pass("officer token carries organization context");
  } else {
    fail("officer token has no organization context", JSON.stringify(officer?.organizationId));
  }

  heading("KYC");
  expect(
    await call("POST", "/api/v1/verifications/submit", {
      token: bidder.token,
      body: { documentType: "national_id", documentNumber: `ID${STAMP}` },
    }),
    201,
    "bidder submits verification",
  );

  const pending = await call("GET", "/api/v1/verifications/pending", { token: approver.token });
  expect(pending, 200, "compliance lists pending verifications");
  const verificationId = pending.body?.items?.[0]?.id;

  expect(
    await call("POST", "/api/v1/verifications/pending", { token: bidder.token }),
    [403, 404],
    "bidder cannot list pending verifications",
  );

  if (verificationId) {
    expect(
      await call("POST", `/api/v1/verifications/${verificationId}/review`, {
        token: approver.token,
        body: { decision: "approved" },
      }),
      200,
      "compliance approves KYC",
    );
  }

  heading("auction");
  const auction = expect(
    await call("POST", "/api/v1/auctions", {
      token: officer.token,
      body: {
        organizationId: orgId,
        title: `Smoke Auction ${STAMP}`,
        description: "Created by the smoke harness",
        auctionType: "open_ascending",
        startPrice: "1000.00",
        minIncrement: "100.00",
        depositAmount: "0.00",
        opensAt: iso(15_000),
        closesAt: iso(10 * 60_000),
      },
    }),
    201,
    "officer creates auction",
  );
  const auctionId = auction?.id;
  if (!auctionId) return;

  expect(
    await call("POST", `/api/v1/auctions/${auctionId}/items`, {
      token: officer.token,
      body: { title: "Toyota Land Cruiser", quantity: 1, condition: "used_good" },
    }),
    201,
    "officer adds an item",
  );

  expect(
    await call("POST", `/api/v1/auctions/${auctionId}/submit`, {
      token: officer.token,
      body: {},
    }),
    200,
    "officer submits for approval",
  );

  // The two-person rule is the headline control: the creator must not be
  // able to approve their own auction.
  expect(
    await call("POST", `/api/v1/auctions/${auctionId}/approve`, {
      token: officer.token,
      body: {},
    }),
    [403, 422],
    "creator cannot approve their own auction",
  );

  expect(
    await call("POST", `/api/v1/auctions/${auctionId}/approve`, {
      token: approver.token,
      body: {},
    }),
    200,
    "a second person approves",
  );

  heading("public discovery");
  const listed = expect(await call("GET", "/api/v1/auctions"), 200, "anonymous auction list");
  if (Array.isArray(listed?.items)) {
    pass(`discovery returned ${listed.items.length} auction(s)`);
  } else {
    fail("discovery payload is not { items: [] }", describe({ status: 200, body: listed }));
  }

  heading("bidding guards");
  // Not yet open, so this must be rejected rather than accepted.
  expect(
    await call("POST", `/api/v1/auctions/${auctionId}/bids`, {
      token: bidder.token,
      body: { amount: "1100.00" },
    }),
    422,
    "bid is refused before the auction opens",
  );

  heading("audit ledger");
  const chain = expect(
    await call("GET", `/api/v1/audit/auctions/${auctionId}/verify`, { token: approver.token }),
    200,
    "verify auction audit chain",
  );
  if (chain?.intact) {
    pass(`chain intact across ${chain.eventCount} event(s)`);
  } else {
    fail("audit chain is not intact", JSON.stringify(chain));
  }

  heading("compliance");
  expect(
    await call("POST", `/api/v1/compliance/auctions/${auctionId}/checks`, {
      token: approver.token,
      body: { notes: "Smoke harness pre-close check" },
    }),
    201,
    "run compliance check",
  );

  heading("notifications");
  expect(
    await call("GET", "/api/v1/notifications", { token: officer.token }),
    200,
    "officer reads their notifications",
  );

  process.stdout.write(
    `\nAuction ${auctionId} opens at ${auction.opensAt}. Leave the API running and the\n` +
      `auction-lifecycle job will move it to live, then closed, on its own.\n`,
  );
}

main()
  .then(() => {
    if (failures === 0) {
      process.stdout.write("\n\x1b[1;32mAll smoke checks passed.\x1b[0m\n");
    } else {
      process.stdout.write(`\n\x1b[1;31m${failures} smoke check(s) failed.\x1b[0m\n`);
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    process.stdout.write(`\n\x1b[1;31mSmoke run crashed:\x1b[0m ${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
