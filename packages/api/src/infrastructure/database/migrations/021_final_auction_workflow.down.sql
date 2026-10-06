DROP TABLE IF EXISTS refund_letters;
DROP TABLE IF EXISTS bid_form_responses;
DROP TABLE IF EXISTS auction_form_fields;
DROP TABLE IF EXISTS auction_document_access;
ALTER TABLE documents DROP COLUMN IF EXISTS requires_payment;
ALTER TABLE auctions DROP COLUMN IF EXISTS document_access_fee;
