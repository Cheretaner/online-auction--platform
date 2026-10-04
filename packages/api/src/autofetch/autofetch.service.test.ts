import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoFetchService } from "./autofetch.service.js";
import { AutoFetchRepository } from "./autofetch.repository.js";
import { adapterRegistry } from "./adapters/index.js";

afterEach(() => vi.restoreAllMocks());

describe("AutoFetchService.createSource", () => {
  it("starts an immediate fetch after a new source is created", async () => {
    const adapter = {
      validateConfig: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      configure: vi.fn(),
      fetchItems: vi.fn(),
      normalize: vi.fn(),
      scoreConfidence: vi.fn(),
      isStale: vi.fn(),
    };

    vi.spyOn(adapterRegistry, "get").mockReturnValue(adapter as any);
    vi.spyOn(AutoFetchRepository.prototype, "createSource").mockResolvedValue({
      id: "source-123",
      organizationId: "org-123",
      name: "Google News RSS",
      adapterType: "rss-feed",
      sourceUrl: "https://news.google.com/rss/search?q=auction+ethiopia",
      adapterConfig: {},
      isActive: true,
      nextFetchAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const fetchSpy = vi.spyOn(AutoFetchService.prototype, "fetchAndQueue").mockResolvedValue({
      fetched: 1,
      queued: 1,
      duplicates: 0,
      stale: 0,
      conflicts: 0,
      errors: 0,
    });

    const service = new AutoFetchService({} as any);
    await service.createSource("org-123", {
      name: "Google News RSS",
      adapterType: "rss-feed",
      sourceUrl: "https://news.google.com/rss/search?q=auction+ethiopia",
      adapterConfig: {},
    });

    expect(fetchSpy).toHaveBeenCalledWith("source-123", "org-123");
  });
});

describe("AutoFetchService source management", () => {
  it("validates and updates an organization-owned source", async () => {
    const adapter = { validateConfig: vi.fn().mockResolvedValue(undefined) };
    const updatedSource = { id: "source-1", organizationId: "org-1", isActive: true };
    vi.spyOn(adapterRegistry, "get").mockReturnValue(adapter as any);
    const updateSpy = vi.spyOn(AutoFetchRepository.prototype, "updateSourceForOrganization").mockResolvedValue(updatedSource as any);

    const service = new AutoFetchService({} as any);
    await expect(service.updateSource("org-1", "source-1", {
      name: "EGP tenders",
      adapterType: "rss-feed",
      sourceUrl: "https://example.gov.et/feed.xml",
      adapterConfig: {},
      isActive: true,
    })).resolves.toBe(updatedSource);

    expect(adapter.validateConfig).toHaveBeenCalledWith({ url: "https://example.gov.et/feed.xml" });
    expect(updateSpy).toHaveBeenCalledWith("source-1", "org-1", expect.objectContaining({ name: "EGP tenders" }));
  });

  it("deactivates and audits a source without deleting it", async () => {
    const source = { id: "source-1", name: "EGP tenders", isActive: false };
    vi.spyOn(AutoFetchRepository.prototype, "deactivateSourceForOrganization").mockResolvedValue(source as any);
    const auditSpy = vi.spyOn(AutoFetchRepository.prototype, "logAuditEvent").mockResolvedValue(undefined);

    const service = new AutoFetchService({} as any);
    await service.removeSource("org-1", "source-1");

    expect(auditSpy).toHaveBeenCalledWith(null, "source-1", "source_deactivated", { name: "EGP tenders" });
  });
});
