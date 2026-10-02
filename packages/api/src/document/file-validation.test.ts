import { describe, expect, it } from "vitest";
import { validateUploadedFile } from "./file-validation.js";

describe("uploaded file validation", () => {
  it("uses file signatures and refuses a mismatched client MIME type", async () => {
    const pdf = Buffer.from("%PDF-1.7\n");
    await expect(validateUploadedFile(pdf, "application/pdf", "identity_document")).resolves.toEqual({
      mimeType: "application/pdf",
      extension: "pdf",
    });
    await expect(validateUploadedFile(pdf, "image/png", "identity_document")).rejects.toThrow(
      "does not match its declared media type",
    );
  });

  it("rejects unsupported bytes and enforces the identity evidence size limit", async () => {
    await expect(validateUploadedFile(Buffer.from("not a document"), "application/pdf", "identity_document"))
      .rejects.toThrow("Only PDF, JPEG, PNG, and WebP files are accepted");
    const oversizedPdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(10 * 1024 * 1024)]);
    await expect(validateUploadedFile(oversizedPdf, "application/pdf", "identity_document"))
      .rejects.toThrow("10 MB upload limit");
  });
});