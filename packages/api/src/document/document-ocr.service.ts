import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors/index.js";

const MAX_PDF_PAGES = 20;
const MIN_EMBEDDED_TEXT = 100;
const MAX_EXTRACTED_CHARS = 500_000;
const PAGE_WIDTH = 1_600;

export interface OcrExtraction {
  text: string;
  method: "embedded_text" | "tesseract";
  confidence: number;
  referenceCandidates: string[];
}

function findReferenceCandidates(text: string): string[] {
  const label = String.raw`(?:ref(?:erence)?(?:\s*(?:no\.?|number|#))?|transaction\s*(?:id|no\.?|number)|receipt\s*(?:no\.?|number)|CPO(?:\s*(?:no\.?|number))?|voucher\s*(?:no\.?|number)|ማጣቀሻ(?:\s*ቁጥር)?|ደረሰኝ(?:\s*ቁጥር)?)`;
  const pattern = new RegExp(`${label}\\s*[:#№.\\-]?\\s*([A-Z0-9\\u1200-\\u137F][A-Z0-9\\u1200-\\u137F/.-]{2,39})`, "giu");
  const candidates = new Map<string, string>();
  for (const match of text.matchAll(pattern)) {
    const candidate = match[1]?.replace(/[.,;:]+$/, "").trim();
    if (!candidate || !/[0-9\u1369-\u137C]/u.test(candidate)) continue;
    const key = candidate.toLocaleUpperCase();
    if (!candidates.has(key)) candidates.set(key, candidate);
    if (candidates.size >= 20) break;
  }
  return [...candidates.values()];
}

function cleanText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

async function extractPdfText(data: Buffer): Promise<{ text: string; pages: number }> {
  const pdf = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  if (pdf.numPages > MAX_PDF_PAGES) {
    await pdf.destroy();
    throw AppError.badRequest(`PDFs with more than ${MAX_PDF_PAGES} pages cannot be OCR processed`);
  }
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items
        .filter((item): item is typeof item & { str: string } => "str" in item)
        .map((item) => item.str)
        .join(" "));
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  return { text: cleanText(pages.join("\n\n")), pages: pages.length };
}

export async function extractDocumentText(data: Buffer, mimeType: string): Promise<OcrExtraction> {
  if (mimeType === "application/pdf") {
    const embedded = await extractPdfText(data);
    if (embedded.text.length >= MIN_EMBEDDED_TEXT) {
      return {
        text: embedded.text,
        method: "embedded_text",
        confidence: 100,
        referenceCandidates: findReferenceCandidates(embedded.text),
      };
    }
  }

  const worker = await createWorker("eng+amh", undefined, {
    cachePath: path.join(env.STORAGE_DIR, ".ocr-cache"),
    errorHandler: () => undefined,
  });
  const recognized: string[] = [];
  const confidences: number[] = [];
  try {
    if (mimeType === "application/pdf") {
      const pdf = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
      try {
        if (pdf.numPages > MAX_PDF_PAGES) {
          throw AppError.badRequest(`PDFs with more than ${MAX_PDF_PAGES} pages cannot be OCR processed`);
        }
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const initial = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(2, PAGE_WIDTH / initial.width) });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext("2d") as never, viewport }).promise;
          const image = canvas.toBuffer("image/png");
          const result = await worker.recognize(image);
          recognized.push(result.data.text);
          confidences.push(result.data.confidence);
          page.cleanup();
        }
      } finally {
        await pdf.destroy();
      }
    } else {
      const result = await worker.recognize(data);
      recognized.push(result.data.text);
      confidences.push(result.data.confidence);
    }
  } finally {
    await worker.terminate();
  }

  const text = cleanText(recognized.join("\n\n"));
  if (!text) {
    throw AppError.unprocessable("OCR did not find readable text");
  }
  return {
    text,
    method: "tesseract",
    confidence: confidences.length ? Math.round(confidences.reduce((sum, score) => sum + score, 0) / confidences.length * 100) / 100 : 0,
    referenceCandidates: findReferenceCandidates(text),
  };
}
