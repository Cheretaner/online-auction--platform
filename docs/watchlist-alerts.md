# Auction watchlists and alerts

Signed-in users can follow up to 100 scheduled or live auctions. Each followed auction has configurable alert types (new bid activity and lifecycle changes) and delivery channels (in-app, email, or linked Telegram). Users can replace alert preferences or remove a watch at any time.

Bid alerts are generic and never include a bidder identity or sealed-bid amount. Bid alerts are limited to one per five minutes per auction and delivery channel. Lifecycle alerts are emitted for scheduling, opening, closing, review, award, and cancellation. Outbox event IDs make fan-out replay-safe. An auction allows up to 500 distinct watchers; this bounds notification fan-out.

Telegram delivery requires the user's Telegram account to be linked and the bot/outbox delivery path to be available. Email uses the configured notification email path. Apply migration `020_auction_watchlists.up.sql` before exposing the controls.
