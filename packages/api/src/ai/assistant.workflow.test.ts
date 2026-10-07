import { describe, expect, it } from "vitest";
import { buildAssistantWorkflowPrompt } from "./assistant.workflow.js";

describe("buildAssistantWorkflowPrompt", () => {
  it("adds role-aware mode instructions, verified boundaries, sources, and evidence requests", () => {
    const prompt = buildAssistantWorkflowPrompt({
      mode: "decision_brief",
      role: "compliance_officer",
      prompt: "Assess the deposit evidence",
      baseUrl: "https://auction.example.test",
      verifiedContext: "Auction 24 is live. Current highest bid: 10,000 ETB.",
      sourceLinks: ["https://auction.example.test/app/deposits"],
    });

    expect(prompt).toContain("Workflow mode: decision_brief");
    expect(prompt).toContain("Effective role: compliance_officer");
    expect(prompt).toContain("Do not invent authority or claim a verified conclusion");
    expect(prompt).toContain("https://auction.example.test/app/deposits");
    expect(prompt).toContain("required evidence");
    expect(prompt).toContain("Assistant-generated recommendation");
    expect(prompt).toContain("User request: Assess the deposit evidence");
  });

  it("preserves a general assistant request while keeping deterministic evidence rules", () => {
    const prompt = buildAssistantWorkflowPrompt({
      mode: "general",
      role: "auction_officer",
      prompt: "What should I review?",
      baseUrl: "https://auction.example.test",
      verifiedContext: "No matching records.",
      sourceLinks: [],
    });

    expect(prompt).toContain("Workflow mode: general");
    expect(prompt).toContain("Effective role: auction_officer");
    expect(prompt).toContain("System verified");
    expect(prompt).not.toContain("Assistant-generated recommendation");
  });
});
