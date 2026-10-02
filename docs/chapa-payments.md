# Chapa Bid-Security Payments

The bidder can keep using the manual CPO, bank-guarantee, and transfer workflow or start a hosted Chapa checkout. Chapa deposits are registered as pending and become bid-eligible only after the webhook signature is checked, the transaction is queried from Chapa's verification endpoint, and its `tx_ref`, amount, and `ETB` currency match the local attempt. A redirect alone never verifies a deposit.

Configure `CHAPA_SECRET_KEY`, `CHAPA_PUBLIC_KEY` (optional for hosted checkout), and `CHAPA_WEBHOOK_SECRET` in the API environment. The secret and webhook secret must be set together. In the Chapa dashboard, register `https://<api-host>/api/v1/webhooks/chapa` with the same webhook secret. Configure one public HTTPS webhook per deployment; never expose the secret to the web client.

The initiation API uses a unique `tx_ref` per attempt. Retry behavior reuses a checkout URL when available and creates a new attempt only after a confirmed failed attempt. Webhook effects are locked and idempotent; events older than 72 hours or more than five minutes in the future are rejected. Amount/currency/reference mismatches are recorded as `reconciliation_required` and do not enable bidding.

Chapa hosted checkout is the only automatic digital payment rail. Award/cancellation triggers idempotent refunds of verified Chapa deposits for non-winners; the winner's Chapa security deposit is refunded only after the final settlement is verified. Refunds remain pending until Chapa's refund verification endpoint reports `refunded`. Reversed or mismatched refunds enter manual reconciliation. CPO/guarantee release remains an officer decision because that instrument is handled outside the platform.

The final settlement is the recorded winning amount in ETB. The current domain is one award and one settlement per auction; the security deposit is not credited against the final amount. Multi-lot auctions must not be used where each lot needs an independent winner/payment until item-level settlement is designed.

Official references:

- Accept payments: https://developer.chapa.co/integrations/accept-payments
- Verify payments: https://developer.chapa.co/integrations/verify-payments
- Webhook signatures and retry behavior: https://developer.chapa.co/integrations/webhooks
- Refund API: https://developer.chapa.co/refund