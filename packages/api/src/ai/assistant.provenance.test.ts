import { describe, expect, it } from "vitest";
import { buildAssistantProvenance } from "./assistant.provenance.js";

describe("buildAssistantProvenance", () => {
  it("records safe provider metadata without response or prompt content", () => {
    const provenance = buildAssistantProvenance({
      actorId: "actor-1",
      actorRoles: ["compliance_officer"],
      auctionId: "auction-1",
      mode: "decision_brief",
      role: "compliance_officer",
      provider: "gemini",
      fallback: false,
      sourceLinks: ["https://example.test/evidence"],
    });

    expect(provenance).toMatchObject({
      auctionId: "auction-1",
      actorId: "actor-1",
      actorRole: "compliance_officer",
      entityType: "ai_assistant",
      action: "ai_assistant.invoked",
      payload: {
        mode: "decision_brief",
        role: "compliance_officer",
        provider: "gemini",
        fallback: false,
        sourceLinkCount: 1,
      },
    });
    expect(provenance.entityId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(provenance.payload).not.toHaveProperty("prompt");
    expect(provenance.payload).not.toHaveProperty("answer");
    expect(provenance.payload).not.toHaveProperty("sourceLinks");
  });
});
