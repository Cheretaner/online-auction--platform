import { z } from "zod";

export const Money = z.string().regex(/^\d+(\.\d{2})?$/, "invalid amount");
