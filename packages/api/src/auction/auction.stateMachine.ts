import type { AuctionStatus } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";

const transitions: Record<AuctionStatus, AuctionStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["scheduled", "draft", "cancelled"],
  scheduled: ["live", "cancelled"],
  live: ["closed", "cancelled"],
  closed: ["under_review", "awarded"],
  under_review: ["awarded", "cancelled"],
  awarded: [],
  cancelled: [],
};

export function assertTransition(from: AuctionStatus, to: AuctionStatus): void {
  if (!transitions[from].includes(to)) {
    throw new AppError(`Invalid auction transition: ${from} -> ${to}`, HttpStatus.UNPROCESSABLE);
  }
}
