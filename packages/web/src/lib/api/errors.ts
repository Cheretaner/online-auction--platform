import type { ErrorCode } from "@auction/shared";

export interface ApiErrorBody {
  message: string;
  code?: ErrorCode | string;
  details?: unknown;
}

export interface ZodFlattenedDetails {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly fieldErrors: Record<string, string[]>;
  readonly formErrors: string[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    const flattened = flattenDetails(body.details);
    this.fieldErrors = flattened.fieldErrors;
    this.formErrors = flattened.formErrors;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidation() {
    return this.status === 400 || this.status === 422;
  }

  get isOffline() {
    return this.status === 0;
  }

  fieldMessage(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

function flattenDetails(details: unknown): {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
} {
  if (!details || typeof details !== "object") {
    return { fieldErrors: {}, formErrors: [] };
  }

  const candidate = details as ZodFlattenedDetails;
  const fieldErrors: Record<string, string[]> = {};
  if (candidate.fieldErrors) {
    for (const [key, value] of Object.entries(candidate.fieldErrors)) {
      if (value && value.length > 0) fieldErrors[key] = value;
    }
  }

  return {
    fieldErrors,
    formErrors: candidate.formErrors ?? [],
  };
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
