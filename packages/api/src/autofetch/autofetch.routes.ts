/**
 * AutoFetch Routes
 * REST API endpoints for source management and review queue
 */

import { Router } from 'express';
import { z } from 'zod';
import { CreateAuctionItemRequest, type Role } from '@auction/shared';
import type { Pool } from 'pg';
import { requireAuth, requireOrganization } from '../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../shared/middleware/asyncHandler.js';
import { validate } from '../shared/middleware/validate.middleware.js';
import { createAutofetchController } from './autofetch.controller.js';

export function createAutofetchRouter(pool: Pool): Router {
  const router = Router();
  const controller = createAutofetchController(pool);

  const AUTHORIZED_ROLES: Role[] = ['org_admin', 'compliance_officer', 'auction_officer'];
  const sourceBody = z.object({
    name: z.string().trim().min(1).max(120),
    adapterType: z.string().trim().min(1).max(64),
    sourceUrl: z.string().url().max(2048).optional(),
    adapterConfig: z.record(z.unknown()).default({}),
  });
  const pendingQuery = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(['pending', 'approved', 'rejected', 'published', 'expired']).optional(),
    sourceId: z.string().uuid().optional(),
    severityMin: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  });
  const idParams = z.object({ sourceId: z.string().uuid() });
  const pendingIdParams = z.object({ pendingItemId: z.string().uuid() });
  const reviewedItemCorrections = CreateAuctionItemRequest.omit({ categorySource: true })
    .partial()
    .extend({ estimatedValue: CreateAuctionItemRequest.shape.estimatedValue.nullable().optional() });

  // ========================================================================
  // Source Management
  // ========================================================================

  /**
   * GET /api/autofetch/sources
   * List all sources for the organization
   * Accessible to: org_admin, auction_officer, compliance_officer
   */
  router.get(
    '/sources',
    requireAuth(AUTHORIZED_ROLES),
    requireOrganization(),
    asyncHandler(controller.listSources)
  );

  /**
   * POST /api/autofetch/sources
   * Create a new data source
   * Accessible to: org_admin, auction_officer
   */
  router.post(
    '/sources',
    requireAuth(['org_admin', 'auction_officer']),
    requireOrganization(),
    validate(sourceBody),
    asyncHandler(controller.createSource)
  );

  router.put(
    '/sources/:sourceId',
    requireAuth(['org_admin', 'auction_officer']),
    requireOrganization(),
    validate(idParams, 'params'),
    validate(sourceBody.extend({ isActive: z.boolean() })),
    asyncHandler(controller.updateSource),
  );

  router.delete(
    '/sources/:sourceId',
    requireAuth(['org_admin', 'auction_officer']),
    requireOrganization(),
    validate(idParams, 'params'),
    asyncHandler(controller.removeSource),
  );

  /**
   * POST /api/autofetch/sources/:sourceId/fetch
   * Manually trigger fetch from a source
   * Accessible to: org_admin, auction_officer
   */
  router.post(
    '/sources/:sourceId/fetch',
    requireAuth(['org_admin', 'auction_officer']),
    requireOrganization(),
    validate(idParams, 'params'),
    asyncHandler(controller.manualFetch)
  );

  // ========================================================================
  // Pending Queue
  // ========================================================================

  /**
   * GET /api/autofetch/pending
   * Get pending review queue (paginated)
   * Accessible to: org_admin, compliance_officer
   */
  router.get(
    '/pending',
    requireAuth(['org_admin', 'compliance_officer']),
    requireOrganization(),
    validate(pendingQuery, 'query'),
    asyncHandler(controller.getPendingQueue)
  );

  /**
   * GET /api/autofetch/pending/:pendingItemId
   * Get a specific pending item with conflicts
   * Accessible to: org_admin, compliance_officer
   */
  router.get(
    '/pending/:pendingItemId',
    requireAuth(['org_admin', 'compliance_officer']),
    requireOrganization(),
    validate(pendingIdParams, 'params'),
    asyncHandler(controller.getPendingItem)
  );

  /**
   * GET /api/autofetch/pending/:pendingItemId/conflicts
   * Get conflicts for a pending item (with summary)
   * Accessible to: org_admin, compliance_officer
   */
  router.get(
    '/pending/:pendingItemId/conflicts',
    requireAuth(['org_admin', 'compliance_officer']),
    requireOrganization(),
    validate(pendingIdParams, 'params'),
    asyncHandler(controller.getConflicts)
  );

  // ========================================================================
  // Review Actions (Approval/Rejection)
  // ========================================================================

  /**
   * POST /api/autofetch/pending/:pendingItemId/approve
   * Approve and publish a pending item
   * Accessible to: org_admin, compliance_officer
   */
  router.post(
    '/pending/:pendingItemId/approve',
    requireAuth(['org_admin', 'compliance_officer']),
    requireOrganization(),
    validate(pendingIdParams, 'params'),
    validate(z.object({ auctionId: z.string().uuid(), corrections: reviewedItemCorrections.optional() })),
    asyncHandler(controller.approvePendingItem)
  );

  /**
   * POST /api/autofetch/pending/:pendingItemId/reject
   * Reject a pending item
   * Accessible to: org_admin, compliance_officer
   */
  router.post(
    '/pending/:pendingItemId/reject',
    requireAuth(['org_admin', 'compliance_officer']),
    requireOrganization(),
    validate(pendingIdParams, 'params'),
    validate(z.object({ reason: z.string().trim().min(1).max(1000) })),
    asyncHandler(controller.rejectPendingItem)
  );

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  /**
   * GET /api/autofetch/stats
   * Get autofetch statistics for the organization
   * Accessible to: org_admin, compliance_officer
   */
  router.get(
    '/stats',
    requireAuth(['org_admin', 'compliance_officer']),
    requireOrganization(),
    asyncHandler(controller.getStats)
  );

  return router;
}
