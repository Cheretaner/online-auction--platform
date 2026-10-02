# Manual Deposit Verification Procedure

This procedure applies to CPOs, bank guarantees, and transfers submitted without the Chapa provider flow. The uploaded file is supporting evidence, not proof that an instrument is valid or funded.

1. Confirm the bidder's identity and that the instrument beneficiary, auction organization, amount, currency (ETB), issue date, and expiry match the auction terms.
2. Verify the instrument directly with the issuing bank using contact details from the bank's official website or the NBE directory. Do not use phone numbers, links, or contact details supplied only by the bidder.
3. Confirm the reference has not already been accepted for another active deposit at that bank. The API rejects matching active references using a keyed digest.
4. Record the decision and a specific rejection reason in the platform. Do not approve based only on a screenshot, uploaded letter, or bidder assertion.
5. After the auction is cancelled or awarded, contact the bank or return the original instrument according to the bank's process. Record the release confirmation reference and upload the bank/return evidence before marking the deposit released.
6. For the winning bidder, do not release bid security until the final settlement is reconciled as paid. Chapa deposits are refunded only through Chapa's refund API and become released only after Chapa confirms `refunded`.

Each document is private by default, signature-checked, malware-scanned in production, and audited on upload and read. Manual bank confirmation is still an officer responsibility; the software cannot confirm a CPO balance without bank access.