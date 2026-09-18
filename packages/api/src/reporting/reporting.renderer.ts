import type { ReportDocument, ReportRequest } from "./reporting.types.js";

export function renderReport(id: string, request: ReportRequest): ReportDocument {
  return {
    id,
    type: request.type,
    generatedAt: new Date().toISOString(),
    content: `Report: ${request.type}\nPeriod: ${request.from ?? "start"} -> ${request.to ?? "now"}`,
  };
}
