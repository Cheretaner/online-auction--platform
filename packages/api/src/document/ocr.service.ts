import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";
import { logger } from "../shared/utils/logger.js";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp"
]);

/**
 * Processes a document to extract text via OCR or PDF parsing.
 */
export async function processDocumentOcr(
  documentId: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; status: "completed" | "failed" | "unsupported" }> {
  try {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      logger.warn({ documentId, size: buffer.length }, "Document too large for OCR");
      return { text: "", status: "unsupported" };
    }

    if (IMAGE_MIME_TYPES.has(mimeType)) {
      const worker = await createWorker("eng+amh");
      try {
        const { data } = await worker.recognize(buffer);
        return { text: data.text, status: "completed" };
      } finally {
        await worker.terminate();
      }
    }

    if (mimeType === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      let text = data.text;
      
      if (text.trim().length < 50) {
         text += "\n[System Note: This appears to be a scanned PDF. Minimal text extracted.]";
      }
      return { text, status: "completed" };
    }

    return { text: "", status: "unsupported" };
  } catch (err) {
    logger.error({ err, documentId }, "OCR processing failed");
    return { text: "", status: "failed" };
  }
}
