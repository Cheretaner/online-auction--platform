import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({ lookup: mocks.dnsLookup }));
vi.mock('node:http', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:http')>(),
  request: mocks.httpRequest,
}));
vi.mock('node:https', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:https')>(),
  request: mocks.httpsRequest,
}));

import { fetchPublicSource, validatePublicSourceUrl } from './public-http.js';

function fakeResponse(statusCode: number, headers: Record<string, string>): IncomingMessage {
  const response = Object.assign(new PassThrough(), {
    statusCode,
    headers,
  });
  return response as unknown as IncomingMessage;
}

function fakeRequest(response: IncomingMessage, body = '') {
  return vi.fn((_url: URL, _options: unknown, callback: (response: IncomingMessage) => void) => {
    const request = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      end: vi.fn(() => {
        callback(response);
        queueMicrotask(() => {
          if (body) response.emit('data', Buffer.from(body));
          response.emit('end');
        });
      }),
      destroy: vi.fn(),
    });
    return request;
  });
}

afterEach(() => vi.clearAllMocks());

describe('public source HTTP safety', () => {
  it('rejects local and credential-bearing URLs', () => {
    expect(() => validatePublicSourceUrl('http://localhost/feed')).toThrow();
    expect(() => validatePublicSourceUrl('https://user:pass@example.com/feed')).toThrow();
  });

  it('blocks DNS responses containing any private address before connecting', async () => {
    mocks.dnsLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);

    await expect(fetchPublicSource('https://feed.example/items', {
      timeoutMs: 1000,
      maxBytes: 1024,
    })).rejects.toMatchObject({ adapterCode: 'URL_BLOCKED' });
    expect(mocks.httpsRequest).not.toHaveBeenCalled();
  });

  it('revalidates redirects and removes credentials across origins', async () => {
    mocks.dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mocks.httpsRequest
      .mockImplementationOnce(fakeRequest(fakeResponse(302, { location: 'https://cdn.example/items' })))
      .mockImplementationOnce(fakeRequest(fakeResponse(200, { 'content-type': 'application/json' }), '{"items":[]}'));

    const result = await fetchPublicSource('https://feed.example/items', {
      timeoutMs: 1000,
      maxBytes: 1024,
      headers: { Authorization: 'Bearer token' },
    });

    expect(result.body.toString()).toBe('{"items":[]}');
    expect(mocks.httpsRequest).toHaveBeenCalledTimes(2);
    expect(mocks.httpsRequest.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer token');
    expect(mocks.httpsRequest.mock.calls[1]?.[1].headers.Authorization).toBeUndefined();
  });

  it('rejects redirects to private IPs without making a second request', async () => {
    mocks.dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mocks.httpsRequest.mockImplementationOnce(fakeRequest(fakeResponse(302, {
      location: 'http://127.0.0.1/admin',
    })));

    await expect(fetchPublicSource('https://feed.example/items', {
      timeoutMs: 1000,
      maxBytes: 1024,
    })).rejects.toThrow();
    expect(mocks.httpsRequest).toHaveBeenCalledTimes(1);
  });
});
