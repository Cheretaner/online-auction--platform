import { z } from "zod";
import { COMPLIANCE_CHECK_STATUS } from "../enums.js";

export const RunComplianceRequest = z.object({
  notes: z.string().max(4000).optional(),
});
export type RunComplianceRequest = z.infer<typeof RunComplianceRequest>;

export const ComplianceCheckStatusSchema = z.enum(COMPLIANCE_CHECK_STATUS);
