export interface DocumentRecord {
  id: string;
  organizationId: string;
  auctionId?: string;
  storageKey: string;
  filename: string;
  contentType: string;
  uploadedBy: string;
  createdAt: string;
}
