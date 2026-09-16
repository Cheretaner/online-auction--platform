import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body"): RequestHandler {
  return (req, _res, next) => {
    req[part] = schema.parse(req[part]);
    next();
  };
}
