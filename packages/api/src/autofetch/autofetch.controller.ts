/**
 * AutoFetch Controller
 * Request handlers for autofetch API endpoints
 */

import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../shared/types/request.js';
import { getAuth, routeParam } from '../shared/types/request.js';
import { AutoFetchService } from './autofetch.service.js';
import type { Pool } from 'pg';

export function createAutofetchController(pool: Pool) {
  const service = new AutoFetchService(pool);

  // ========================================================================
  // Source Management
  // ========================================================================

  /**
   * GET /api/autofetch/sources
   * List all sources for the user's organization
   */
  const listSources: RequestHandler = async (req, res) => {
    const organizationId = getAuth(req).organizationId!;

    const sources = await service.getSourcesByOrg(organizationId);

    res.json({
      success: true,
      data: sources,
    });
  };

  /**
   * POST /api/autofetch/sources
   * Create a new data source
   *
   * Body: {
   *   name: string
   *   adapterType: 'json-feed' | 'csv-upload' | etc
   *   sourceUrl?: string
   *   adapterConfig: object
   * }
   */
  const createSource: RequestHandler = async (req, res) => {
    const organizationId = getAuth(req).organizationId!;
    const { name, adapterType, sourceUrl, adapterConfig } = req.body;

    const source = await service.createSource(organizationId, {
      name,
      adapterType,
      sourceUrl,
      adapterConfig,
    });

    res.status(201).json({
      success: true,
      data: source,
    });
  };

  /**
   * POST /api/autofetch/sources/:sourceId/fetch
   * Manually trigger fetch from a source
   */
  const manualFetch: RequestHandler = async (req, res) => {
    const organizationId = getAuth(req).organizationId!;
    const sourceId = routeParam(req.params.sourceId);

    const result = await service.fetchAndQueue(sourceId, organizationId);

    res.json({
      success: true,
      data: result,
    });
  };

  // ========================================================================
  // Pending Queue Management
  // ========================================================================

  /**
   * GET /api/autofetch/pending
   * Get pending review queue
   *
   * Query params:
   * - limit: number (default: 50, max: 500)
   * - offset: number (default: 0)
   * - status: 'pending' | 'approved' | 'rejected' | etc
   * - sourceId: filter by source
   */
  const getPendingQueue: RequestHandler = async (req, res) => {
    const organizationId = getAuth(req).organizationId!;
    const query = req.query as { limit?: number; offset?: number; status?: string; sourceId?: string; severityMin?: string };
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const filters = {
      status: query.status,
      sourceId: query.sourceId,
      severityMin: query.severityMin,
    };

    const result = await service.getPendingQueue(organizationId, filters, limit, offset);

    res.json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/autofetch/pending/:pendingItemId
   * Get a specific pending item with conflicts
   */
  const getPendingItem: RequestHandler = async (req, res) => {
    const pendingItemId = routeParam(req.params.pendingItemId);
    const item = await service.getPendingItem(pendingItemId, getAuth(req).organizationId!);
    const conflicts = await service.getConflictFlags(pendingItemId);

    res.json({
      success: true,
      data: {
        item,
        conflicts,
      },
    });
  };

  /**
   * GET /api/autofetch/pending/:pendingItemId/conflicts
   * Get conflicts for a pending item
   */
  const getConflicts: RequestHandler = async (req, res) => {
    const pendingItemId = routeParam(req.params.pendingItemId);
    await service.getPendingItem(pendingItemId, getAuth(req).organizationId!);
    const conflicts = await service.getConflictFlags(pendingItemId);

    res.json({
      success: true,
      data: {
        conflicts,
        count: conflicts.length,
        critical: conflicts.filter((c) => c.severity === 'CRITICAL').length,
        high: conflicts.filter((c) => c.severity === 'HIGH').length,
        medium: conflicts.filter((c) => c.severity === 'MEDIUM').length,
        low: conflicts.filter((c) => c.severity === 'LOW').length,
      },
    });
  };

  // ========================================================================
  // Review Actions
  // ========================================================================

  /**
   * POST /api/autofetch/pending/:pendingItemId/approve
   * Approve a pending item for publication
   *
   * Body: {
   *   auctionId: string (auction to associate with)
   * }
   */
  const approvePendingItem: RequestHandler = async (req, res) => {
    const actor = getAuth(req);
    const pendingItemId = routeParam(req.params.pendingItemId);
    const { auctionId } = req.body;

    if (!auctionId) {
      res.status(400).json({
        success: false,
        error: 'auctionId is required',
      });
      return;
    }

    const item = await service.approveAndPublish(pendingItemId, actor, auctionId);

    res.json({
      success: true,
      message: 'Pending item approved and published',
      data: item,
    });
  };

  /**
   * POST /api/autofetch/pending/:pendingItemId/reject
   * Reject a pending item
   *
   * Body: {
   *   reason: string
   * }
   */
  const rejectPendingItem: RequestHandler = async (req, res) => {
    const actor = getAuth(req);
    const pendingItemId = routeParam(req.params.pendingItemId);
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'reason is required',
      });
      return;
    }

    await service.reject(pendingItemId, actor, reason);

    res.json({
      success: true,
      message: 'Pending item rejected',
    });
  };

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  /**
   * GET /api/autofetch/stats
   * Get autofetch statistics for org
   */
  const getStats: RequestHandler = async (req, res) => {
    const organizationId = getAuth(req).organizationId!;

    const stats = await service.getConflictStats(organizationId);

    res.json({
      success: true,
      data: stats,
    });
  };

  return {
    listSources,
    createSource,
    manualFetch,
    getPendingQueue,
    getPendingItem,
    getConflicts,
    approvePendingItem,
    rejectPendingItem,
    getStats,
  };
}
