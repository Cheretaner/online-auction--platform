import type { ErrorCode } from "@auction/shared";
import { HttpStatus } from "./httpStatus.js";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code?: ErrorCode;
  readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: ErrorCode,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
