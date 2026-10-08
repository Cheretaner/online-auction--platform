import { describe, expect, it } from "vitest";
import { buildGeminiUrl, extractGeminiText } from "./gemini.js";

describe("Gemini adapter contract", () => {
  it("builds the native Gemini generateContent URL with the configured model", () => {
    expect(buildGeminiUrl(
      "https://generativelanguage.googleapis.com/v1beta",
      "gemini-flash-latest",
      "gemini-key",
    )).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=gemini-key",
    );
  });

  it("extracts text from the native Gemini candidate response", () => {
    expect(extractGeminiText({
      candidates: [{
        content: {
          parts: [{ text: "Review required evidence" }, { text: " and continue." }],
        },
      }],
    })).toBe("Review required evidence and continue.");
  });
});
