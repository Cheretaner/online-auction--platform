import type { AuctionStatus } from "@auction/shared";

export const ALLOWED_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["scheduled", "draft", "cancelled"],
  scheduled: ["live", "cancelled"],
  live: ["closed", "cancelled", "under_review"],
  closed: ["under_review", "awarded", "cancelled"],
  under_review: ["awarded", "cancelled"],
  awarded: [],
  cancelled: [],
};

export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
