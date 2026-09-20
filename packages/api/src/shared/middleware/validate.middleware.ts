import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

type RequestPart = "body" | "query" | "params";

/**
 * Validates and, importantly, REPLACES the request part with the parsed
 * result, so downstream handlers receive coerced values and applied
 * defaults rather than raw strings.
 *
 * In Express 5 `req.query` is a getter, so it is assigned via
 * defineProperty instead of direct mutation.
 */
export function validate(schema: ZodTypeAny, part: RequestPart = "body"): RequestHandler {
  return (req, _res, next) => {
    // A request with no body at all (common on DELETE) arrives as undefined;
    // treat it as an empty object so schemas made entirely of optional
    // fields still pass.
    const input = part === "body" ? (req.body ?? {}) : req[part];

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    if (part === "query") {
      Object.defineProperty(req, "query", {
        value: parsed.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[part] = parsed.data as never;
    }

    next();
  };
}
