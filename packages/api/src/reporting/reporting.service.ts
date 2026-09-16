import { randomUUID } from "node:crypto";
import { renderReport } from "./reporting.renderer.js";
import * as repo from "./reporting.repository.js";
import type { ReportDocument, ReportRequest } from "./reporting.types.js";

export async function generateReport(request: ReportRequest): Promise<ReportDocument> {
  const id = randomUUID();
  const report = renderReport(id, request);
  await repo.saveReport(report);
  return report;
}

export async function getReport(id: string): Promise<ReportDocument | null> {
  return repo.getReport(id);
}
