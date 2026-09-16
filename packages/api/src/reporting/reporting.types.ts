export interface ReportRequest {
  type: "auction_summary" | "compliance" | "audit_trail";
  from?: string;
  to?: string;
}

export interface ReportDocument {
  id: string;
  type: ReportRequest["type"];
  generatedAt: string;
  content: string;
}
