import type { ErrorCode } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";

export class BiddingError extends AppError {
  constructor(message: string, code: ErrorCode) {
    super(message, HttpStatus.UNPROCESSABLE, code);
    this.name = "BiddingError";
  }
}
