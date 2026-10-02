import { createConnection } from "node:net";
import { fileTypeFromBuffer } from "file-type";
import { env } from "../config/env.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";

const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const CHUNK_SIZE = 64 * 1024;

async function scanWithClamAv(data: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
    let response = "";
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(env.FILE_SCAN_TIMEOUT_MS, () => finish(new Error("ClamAV scan timed out")));
    socket.on("error", (error) => finish(new Error(`ClamAV scan unavailable: ${error.message}`)));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (!response.includes("\0")) return;
      if (response.includes("FOUND")) return finish(new Error("File rejected by antivirus scanner"));
      if (!response.includes("OK")) return finish(new Error("ClamAV returned an invalid scan response"));
      finish();
    });
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.subarray(offset, Math.min(offset + CHUNK_SIZE, data.length));
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}

export async function validateUploadedFile(
  data: Buffer,
  declaredMimeType: string,
  documentType: string,
): Promise<{ mimeType: string; extension: string }> {
  const detected = await fileTypeFromBuffer(data);
  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    throw AppError.badRequest("Only PDF, JPEG, PNG, and WebP files are accepted");
  }
  if (declaredMimeType !== detected.mime) {
    throw AppError.badRequest("The file content does not match its declared media type");
  }
  const maxBytes = documentType === "identity_document" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
  if (data.byteLength > maxBytes) {
    throw AppError.badRequest(`This document type has a ${Math.floor(maxBytes / (1024 * 1024))} MB upload limit`);
  }
  if (env.FILE_SCAN_ENABLED) {
    try {
      await scanWithClamAv(data);
    } catch (error) {
      if (error instanceof Error && error.message.includes("rejected by antivirus")) {
        throw AppError.badRequest("The uploaded file was rejected by the malware scanner");
      }
      throw new AppError("Upload scanning is unavailable; try again later", HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
  return { mimeType: detected.mime, extension: ALLOWED_TYPES.get(detected.mime)! };
}