# Final auction workflow

The platform now follows four fixed stages:

1. **Document access and registration**: tender documents marked `requiresPayment`
   are downloaded only after a successful Chapa payment. The successful payment
   creates the bidder's auction document-access registration.
2. **Bid submission**: auction officers configure `text`, `number`, `choice`, or
   `range` fields. Paid bidders must submit required values with their bid.
   Manual CPO deposits require a private `cpo_proof` upload and remain pending
   until an authorized validator reviews them.
3. **Settlement**: the system issues loser refund letters containing the
   organization stamp and letter number for dashboard download. Winners do not
   use Chapa settlement; they complete settlement through the issuing bank's
   physical CPO workflow.
4. **Closing and publication**: the lifecycle job closes auctions at their
   effective deadline. Bids and form responses are validated before acceptance,
   and the awarded auction exposes its winner and winning amount through the
   public auction dashboard.

Chapa webhook handling verifies the provider amount, currency, reference, and
replay state before document access is granted.
