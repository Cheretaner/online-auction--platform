# Reverse-auction and multi-lot rules proposal

This document defines an MVP behavior contract before changing bid storage or participant screens. It is a proposal for pilot-owner approval; existing forward auctions keep their current behavior.

## Reverse auction MVP

- A reverse auction is procurement: the organization buys the listed goods or service, and eligible suppliers compete by lowering their offered total price.
- MVP reverse auctions use open, descending bids only. A new bid must be at least the configured minimum decrement below the current lowest active bid. The published starting price is the maximum eligible price (ceiling); a published reserve/target is the lowest acceptable price. Award only to the lowest eligible active bidder whose price meets the target; otherwise mark the result unsold.
- Existing identity, verified-deposit, participant eligibility, one-bidder-per-auction, idempotency, rate-limit, anti-snipe, close-time, and audit-chain controls apply. An extension updates the same published closing deadline for all lots in the parent auction.
- Withdrawals follow the current policy and create immutable audit events. After a withdrawal, the next lowest eligible active offer becomes leading. Staff cannot bid on their organization's auction.
- Sealed reverse bidding, automatic price matching, negotiation rounds, split awards, and post-close price changes are out of MVP.

## Multi-lot MVP

- Every lot is awarded independently. A bid identifies exactly one lot; a bidder may bid on several lots, with at most one active bid per bidder per lot. The bidder sees and confirms the lot title and amount before submission.
- Each lot has its own opening/closing result, reserve/target, bid count, leading amount, and winning supplier. The parent auction provides shared publication, eligibility, deposit, schedule, and cancellation controls. All lots share the parent's close and anti-snipe deadline in MVP.
- A lot with no eligible bid meeting its reserve is unsold; it does not block awards for other lots. The parent auction becomes awarded after officers decide each lot, and must show awarded, unsold, or still awaiting decision per lot.
- Package bids, conditional bundles, quantity splitting, partial fulfillment, and cross-lot dependencies are deferred. The initial migration must preserve legacy auction-level bids as the single implicit lot without rewriting historical audit records.

## Data, audit, and permissions

- Add explicit auction direction and lot-bidding mode, and a nullable `lot_id` on bids for backward compatibility. New multi-lot bids require a lot ID. Add per-lot target/reserve and decrement fields with currency validation.
- Chain bid and withdrawal events with auction ID, lot ID, bid ID, amount, and prior-head linkage. Public outputs expose only permitted leading results; sealed privacy rules remain unchanged for existing sealed forward auctions.
- Organization access and the existing two-person approval rule apply at auction level. Lot criteria become immutable after approval/publication; changes require a recorded amendment and renewed approval before bidding starts.
- Before implementation, product owners must approve reverse-auction eligibility/deposit policy, reserve visibility, withdrawal window, and whether per-lot deposits are required. Database migration, web/Telegram clients, open-data schema, reporting, anomaly checks, and verification must ship together.

## Acceptance gates

Pilot-owner approval is required before schema work. Then verify two bidders lowering prices under decrement/ceiling/target constraints; tie handling; anti-snipe behavior; withdrawals; simultaneous independent lot awards; unsold lots; sealed-bid privacy regression; audit verification; and participant displays before and after close.
