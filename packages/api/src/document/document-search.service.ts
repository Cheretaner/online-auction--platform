import * as repo from "./document-search.repository.js";
import * as documentService from "./document.service.js";
import type { DocumentSearchResult, DocumentSearchFilters } from "./document-search.repository.js";
import type { Role } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";

export interface SearchDocumentsInput {
  query: string;
  auctionId?: string;
  documentType?: string;
  language?: 'english' | 'amharic' | 'both';
  limit?: number;
  offset?: number;
  viewer: {
    userId: string;
    roles: Role[];
    organizationId?: string;
  };
}

/**
 * Search documents with access control
 * Only returns documents the viewer is allowed to see
 */
export async function searchDocuments(input: SearchDocumentsInput): Promise<{
  items: DocumentSearchResult[];
  total: number;
  query: string;
}> {
  if (!input.query || input.query.trim().length < 2) {
    throw new AppError("Search query must be at least 2 characters", HttpStatus.BAD_REQUEST);
  }

  const filters: DocumentSearchFilters = {
    query: input.query,
    auctionId: input.auctionId,
    documentType: input.documentType,
    language: input.language ?? 'both',
    limit: Math.min(input.limit ?? 50, 100), // Max 100 results per page
    offset: input.offset ?? 0,
  };

  // If not super_admin or compliance_officer, only search own documents
  const isAdmin = input.viewer.roles.includes("super_admin");
  const isCompliance = input.viewer.roles.includes("compliance_officer");
  
  if (!isAdmin && !isCompliance) {
    // Officers can see documents in their org's auctions
    // Regular users can only see their own uploads or public documents
    const isOfficer = input.viewer.roles.some((role) =>
      ["org_admin", "auction_officer"].includes(role),
    );

    if (!isOfficer) {
      filters.uploadedBy = input.viewer.userId;
    }
  }

  const result = await repo.searchDocuments(filters);

  // Additional access control: filter out documents the viewer can't read
  const accessibleItems: DocumentSearchResult[] = [];
  for (const doc of result.items) {
    const fullDoc = await documentService.getDocument(doc.id);
    if (fullDoc) {
      const canRead = await documentService.canReadDocument(fullDoc, input.viewer);
      if (canRead) {
        accessibleItems.push(doc);
      }
    }
  }

  return {
    items: accessibleItems,
    total: result.total,
    query: input.query,
  };
}

/**
 * Search documents within a specific auction
 */
export async function searchAuctionDocuments(
  auctionId: string,
  query: string,
  viewer: { userId: string; roles: Role[]; organizationId?: string },
): Promise<DocumentSearchResult[]> {
  const result = await searchDocuments({
    query,
    auctionId,
    limit: 50,
    offset: 0,
    viewer,
  });

  return result.items;
}
