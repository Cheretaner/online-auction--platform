const reports = new Map<string, import("./reporting.types.js").ReportDocument>();

export async function saveReport(report: import("./reporting.types.js").ReportDocument): Promise<void> {
  reports.set(report.id, report);
}

export async function getReport(id: string) {
  return reports.get(id) ?? null;
}
