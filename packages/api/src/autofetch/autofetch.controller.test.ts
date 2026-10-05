import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoFetchService } from './autofetch.service.js';
import { createAutofetchController } from './autofetch.controller.js';

describe('AutoFetch source list response', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns sources in the ItemList shape expected by the web client', async () => {
    const sources = [{ id: 'source-1', name: 'Public feed' }];
    vi.spyOn(AutoFetchService.prototype, 'getSourcesByOrg').mockResolvedValue(sources as any);
    const controller = createAutofetchController({} as Pool);
    const response = { json: vi.fn() } as unknown as Response;
    const request = {
      auth: {
        userId: 'user-1',
        organizationId: 'org-1',
        roles: ['org_admin'],
      },
    } as unknown as Request;

    await controller.listSources(request, response, vi.fn());

    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: { items: sources },
    });
  });
});