import multer from "multer";

// Multipart bodies are buffered in memory; bound metadata as tightly as files.
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
    fields: 4,
    fieldSize: 2 * 1024,
    fieldNameSize: 64,
    parts: 5,
  },
});