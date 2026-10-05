# Offline auction access

Public auction listings, published auction details, and lot descriptions use the existing bounded seven-day cache. Authenticated bid history is handled separately: only bid records whose bidder ID matches the locally stored signed-in account are written to tab-scoped `sessionStorage`. The cached receipt fields exclude other bidders, commitment secrets, idempotency keys, and documents. Bid-history cache is limited to 30 auctions, 50 bids per auction, 180 KB, and seven days.

When the API cannot be reached because the browser has no network, the last locally stored session may remain available so the bidder can read the cached history. A server authorization rejection still clears the session. Signing out or receiving an authorization revocation clears the private bid cache and its React Query records. Closing the tab clears `sessionStorage`.

The UI shows the cache timestamp and disables bid submission while offline. Cached bid history is read-only and can be stale; it is not proof that the auction is still open or that a pending bid was accepted. Users must reconnect and check the live record before acting.
