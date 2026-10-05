import * as repo from "./document-search.repository.js";
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
    limit: Math.max(1, Math.min(input.limit ?? 50, 100)),
    offset: Math.max(0, input.offset ?? 0),
    viewer: input.viewer,
  };

  const result = await repo.searchDocuments(filters);
  return { ...result, query: input.query };
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
