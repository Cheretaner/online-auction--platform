import type { AuthContext } from "../shared/types/request.js";
import type { RealtimeEvent } from "../infrastructure/realtime/realtime.adapter.js";
import { findAuction } from "../bidding/bidding.repository.js";
import { canViewAuction, isAuctionStaff } from "./auction.visibility.js";

/** Events an outside viewer of a public auction may receive. Anomaly,
 * compliance, dispute and report-draft events stay with the auction's staff. */
const PUBLIC_AUCTION_EVENTS = new Set([
  "bid.placed",
  "bid.withdrawn",
  "auction.opened",
  "auction.extended",
  "auction.closed",
  "auction.cancelled",
  "auction.under_review",
  "sealed.opened",
  "report.published",
]);

/** Payload fields that identify people. Stripped for outside viewers so the
 * live feed does not reveal who is bidding. */
const PRIVATE_PAYLOAD_FIELDS = ["bidderId", "userId", "actorId", "openedBy", "leadingBidId"];

export type ChannelFilter = (event: RealtimeEvent) => RealtimeEvent | null;

export type ChannelAccess =
  | { allowed: true; filter: ChannelFilter }
  | { allowed: false; status: 400 | 403 | 404; message: string };

const passThrough: ChannelFilter = (event) => event;

function redactForPublic(event: RealtimeEvent): RealtimeEvent | null {
  if (!PUBLIC_AUCTION_EVENTS.has(event.event)) return null;
  if (!event.payload || typeof event.payload !== "object") return event;
  const payload = { ...(event.payload as Record<string, unknown>) };
  for (const field of PRIVATE_PAYLOAD_FIELDS) delete payload[field];
  return { ...event, payload };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decides whether `auth` may subscribe to `channel` and how events on it are
 * filtered. Only two channel shapes exist for clients:
 * - `user:<own id>`: the caller's personal feed.
 * - `auction:<id>`: an auction the caller can see. Staff get every event;
 *   everyone else gets the public subset with identities removed.
 * Everything else (including the old `*` default) is refused.
 */
export async function authorizeEventChannel(channel: string | undefined, auth: AuthContext): Promise<ChannelAccess> {
  if (!channel) {
    return { allowed: false, status: 400, message: "A channel query parameter is required" };
  }
  const [kind, id, ...rest] = channel.split(":");
  if (rest.length > 0 || !id || !UUID.test(id)) {
    return { allowed: false, status: 400, message: "Unknown channel" };
  }

  if (kind === "user") {
    return id === auth.userId
      ? { allowed: true, filter: passThrough }
      : { allowed: false, status: 403, message: "Forbidden" };
  }

  if (kind === "auction") {
    const auction = await findAuction(id);
    if (!auction || !(await canViewAuction(auction, auth))) {
      return { allowed: false, status: 404, message: "Auction not found" };
    }
    const staff = await isAuctionStaff(auction.orgId, auth);
    return { allowed: true, filter: staff ? passThrough : redactForPublic };
  }

  return { allowed: false, status: 400, message: "Unknown channel" };
}
