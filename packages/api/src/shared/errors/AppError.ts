import type { ErrorCode } from "@auction/shared";
import { HttpStatus } from "./httpStatus.js";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code?: ErrorCode;
  readonly details?: unknown;
  readonly isOperational = true;

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

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, HttpStatus.BAD_REQUEST, undefined, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(message, HttpStatus.NOT_FOUND);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, HttpStatus.CONFLICT, undefined, details);
  }

  static unprocessable(message: string, code?: ErrorCode, details?: unknown): AppError {
    return new AppError(message, HttpStatus.UNPROCESSABLE, code, details);
  }

  toJSON(): { message: string; code?: ErrorCode; details?: unknown } {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}
