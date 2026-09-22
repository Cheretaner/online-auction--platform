/**
 * AutoFetch Routes
 * REST API endpoints for source management and review queue
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, requireOrganization } from '../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../shared/middleware/asyncHandler.js';
import { createAutofetchController } from './autofetch.controller.js';

export function createAutofetchRouter(pool: Pool): Router {
  const router = Router();
  const controller = createAutofetchController(pool);

  const AUTHORIZED_ROLES = ['org_admin', 'compliance_officer', 'auction_officer'];

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
    asyncHandler(controller.createSource)
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
