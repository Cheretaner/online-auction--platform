DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auction_document_access
    GROUP BY auction_id, bidder_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot roll back paid-document retry history without deleting payment records';
  END IF;
END $$;

DROP INDEX IF EXISTS auction_document_access_auction_bidder_created_idx;

ALTER TABLE auction_document_access
  DROP COLUMN IF EXISTS checkout_url;

ALTER TABLE auction_document_access
  ADD CONSTRAINT auction_document_access_auction_id_bidder_id_key
  UNIQUE (auction_id, bidder_id);
