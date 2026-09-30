import { z } from "zod";
import { REPORT_TYPE } from "../enums.js";

export const GenerateReportRequest = z.object({
  auctionId: z.string().uuid(),
  type: z.enum(REPORT_TYPE),
});
export type GenerateReportRequest = z.infer<typeof GenerateReportRequest>;
