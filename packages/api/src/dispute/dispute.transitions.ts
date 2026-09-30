import type { DisputeStatus } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";

const ALLOWED: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["under_review"],
  under_review: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};

export function assertDisputeTransition(from: DisputeStatus, to: DisputeStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new AppError(
      `Cannot move dispute from ${from} to ${to}`,
      HttpStatus.UNPROCESSABLE,
      "DISPUTE_INVALID_TRANSITION",
    );
  }
}
