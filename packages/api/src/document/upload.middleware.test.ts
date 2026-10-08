import express from "express";
import type { AddressInfo } from "node:net";
import multer from "multer";
import { describe, expect, it } from "vitest";
import { errorMiddleware } from "../shared/middleware/error.middleware.js";
import { documentUpload } from "./upload.middleware.js";

function createUploadTestApp() {
  const app = express();
  app.post("/", documentUpload.single("file"), (req, res) => {
    res.json({ fields: Object.keys(req.body), fileName: req.file?.originalname });
  });
  app.post("/file-size-error", (_req, _res, next) => next(new multer.MulterError("LIMIT_FILE_SIZE")));
  app.use(errorMiddleware);
  return app;
}

async function post(app: express.Express, path: string, form = new FormData()) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      body: form,
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe("document multipart upload limits", () => {
  it("accepts one file and all four supported metadata fields", async () => {
    const form = new FormData();
    form.append("docType", "identity_document");
    form.append("isPrivate", "true");
    form.append("auctionId", "auction-id");
    form.append("requiresPayment", "false");
    form.append("file", new Blob(["%PDF-1.7\n"], { type: "application/pdf" }), "evidence.pdf");
    const response = await post(createUploadTestApp(), "/", form);
    const body = await response.json() as { fields: string[]; fileName: string };

    expect(response.status).toBe(200);
    expect(body.fields).toHaveLength(4);
    expect(body.fileName).toBe("evidence.pdf");
  });

  it("rejects excess multipart fields before they accumulate in memory", async () => {
    const form = new FormData();
    form.append("one", "1");
    form.append("two", "2");
    form.append("three", "3");
    form.append("four", "4");
    form.append("five", "5");
    const response = await post(createUploadTestApp(), "/", form);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("LIMIT_FIELD_COUNT");
  });

  it("rejects oversized multipart metadata fields", async () => {
    const form = new FormData();
    form.append("docType", "x".repeat(2049));
    const response = await post(createUploadTestApp(), "/", form);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("LIMIT_FIELD_VALUE");
  });

  it("maps oversized files to HTTP 413", async () => {
    const response = await post(createUploadTestApp(), "/file-size-error");
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("LIMIT_FILE_SIZE");
  });
});