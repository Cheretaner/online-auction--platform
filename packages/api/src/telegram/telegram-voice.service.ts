import { env } from "../config/env.js";
import { logger } from "../shared/utils/logger.js";
import type { VoiceParseResult } from "./telegram.types.js";

/**
 * Downloads audio file buffer from a Telegram file URL.
 */
export async function downloadTelegramAudio(fileUrl: string): Promise<Buffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Telegram voice file: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parses a voice message using Gemini's native multimodal audio understanding.
 * Supports both English and Amharic voice notes.
 */
export async function processVoiceNote(audioBuffer: Buffer, mimeType = "audio/ogg"): Promise<VoiceParseResult> {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey || env.AI_PROVIDER === "stub") {
    logger.info("Voice processing running in fallback/stub mode");
    return {
      transcription: "Voice note received (AI audio transcription is currently in preview/stub mode).",
      intent: "help",
      details: "To place a bid or check status, you can also type commands like /auctions, /bid <id> <amount>, or /help.",
    };
  }

  const base64Audio = audioBuffer.toString("base64");
  const model = env.GEMINI_MODEL.includes("gemini") ? env.GEMINI_MODEL : "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are an AI assistant for a transparent public auction platform in Ethiopia.
Listen to this audio note carefully. The speaker may use English or Amharic (አማርኛ).

Tasks:
1. Transcribe what was said accurately. If spoken in Amharic, transcribe in Fidel and add English translation in details.
2. Determine the user's intent:
   - "bid": The user intends to place a bid. Extract any mention of auction ID / number and amount (e.g. 50,000 ETB / Birr).
   - "discover": The user wants to see or search available auctions.
   - "status": The user asks about auction status, current highest bid, or their standing.
   - "verify": The user asks to verify the audit chain or cryptographic proof.
   - "help": The user needs help or instructions.
   - "question": General question about deposits, CPOs, registration, or platform rules.

Return ONLY a valid JSON object without markdown code blocks:
{
  "transcription": "exact transcription",
  "intent": "bid" | "discover" | "status" | "verify" | "help" | "question",
  "auctionId": null,
  "auctionNumber": null,
  "amount": null,
  "language": "en" | "am",
  "details": "short summary or translation"
}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS * 2);

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Audio,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Gemini audio API returned ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleanJson) as VoiceParseResult;

    return {
      transcription: parsed.transcription || "Audio processed",
      intent: parsed.intent || "question",
      auctionId: parsed.auctionId ?? null,
      auctionNumber: parsed.auctionNumber ?? null,
      amount: parsed.amount ? String(parsed.amount).replace(/[^0-9.]/g, "") : null,
      language: parsed.language || "en",
      details: parsed.details ?? null,
    };
  } catch (error) {
    logger.warn({ err: error }, "Failed to process voice note with Gemini, falling back");
    return {
      transcription: "Voice note received (transcription service temporarily unavailable).",
      intent: "help",
      details: "You can use text commands such as /auctions, /bid, or /verify in the meantime.",
    };
  }
}
