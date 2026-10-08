ALTER TABLE auction_document_access
  DROP CONSTRAINT IF EXISTS auction_document_access_auction_id_bidder_id_key;

ALTER TABLE auction_document_access
  ADD COLUMN IF NOT EXISTS checkout_url TEXT;

CREATE INDEX IF NOT EXISTS auction_document_access_auction_bidder_created_idx
  ON auction_document_access (auction_id, bidder_id, created_at DESC);
