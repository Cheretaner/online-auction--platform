# Document text extraction

Auction officers, organization admins, compliance officers, and super admins can request text extraction on auction specifications, terms, inspection reports, and other auction documents. The API verifies organization ownership and the original document checksum before processing. Identity evidence is excluded. Private bidder CPO proofs uploaded as `other` documents can be processed from the deposit review screen.

PDFs with embedded text use PDF.js. Image-only PDFs and supported images use Tesseract with English and Amharic language models. Processing runs asynchronously; the UI polls status and lets an authorized officer correct the extracted text against the unchanged original. Unreviewed text is explicitly marked as machine-extracted and is never used as verified evidence. Search returns only text that an officer has confirmed, scoped to that officer's auction organization. Labeled reference numbers can be suggested from the extracted text; they are compared to the bidder-submitted reference only after an officer records a check. OCR never verifies a deposit or changes its reference.

The OCR engine runs inside the API container. On first use, Tesseract downloads its `eng` and `amh` language data over HTTPS and caches it under `STORAGE_DIR/.ocr-cache`; the API process must be able to write there and reach the Tesseract.js language-data CDN. Original uploads and extracted text are not sent to a hosted AI provider. Boundaries are 20 PDF pages, 20 MB upload size, and 500,000 extracted characters. A failed run can be retried from the document list.

Apply database migration `019_document_ocr.up.sql` before enabling the workflow. `019_document_ocr.down.sql` removes OCR results and the reviewed-text search index.
