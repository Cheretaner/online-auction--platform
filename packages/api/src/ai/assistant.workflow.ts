export type AssistantWorkflowMode =
  | "general"
  | "summarize_auction"
  | "missing_information"
  | "compare_bid_patterns"
  | "suggest_investigation"
  | "draft_review_note"
  | "decision_brief"
  | "required_evidence";

export interface AssistantWorkflowPromptInput {
  mode: AssistantWorkflowMode;
  role: string;
  prompt: string;
  baseUrl: string;
  verifiedContext: string;
  sourceLinks: string[];
}

export function buildAssistantWorkflowPrompt(input: AssistantWorkflowPromptInput): string {
  const sourceList = input.sourceLinks.length
    ? input.sourceLinks.map((link) => `- ${link}`).join("\n")
    : "- No source links were provided";
  const modeSpecific = input.mode === "decision_brief"
    ? "Return a concise decision brief with findings, required evidence, recommended next action, and unresolved questions. Include 'Assistant-generated recommendation' for every recommendation."
    : input.mode === "draft_review_note"
      ? "Draft a neutral officer review note that does not make a final adjudication. Include only supported facts and an explicit 'Assistant-generated draft' label."
      : input.mode === "required_evidence"
        ? "Produce a list of required evidence, grouped by category and tied to the supplied source links. Distinguish missing evidence from available evidence."
        : input.mode === "compare_bid_patterns"
          ? "Compare bid patterns using only the supplied numeric and categorical evidence. Do not infer a fraud conclusion or claim that a pattern is anomalous unless the deterministic rules support it."
          : input.mode === "suggest_investigation"
            ? "Suggest an investigation plan with observable questions and evidence to collect. Never direct a user to access private data outside their authorized role."
            : input.mode === "missing_information"
              ? "Identify missing information and list each item's operational impact, while keeping unresolved questions clearly separated from verified facts."
              : input.mode === "summarize_auction"
                ? "Summarize the auction's status, format, timing, prices, lots, and eligibility rules. Clearly label any unavailable fields as not supplied."
                : "Answer the user request using the supplied context and do not invent missing facts.";

  return [
    "You are an AI-assisted review workflow for Cheretanet.",
    `Workflow mode: ${input.mode}`,
    `Effective role: ${input.role}`,
    "Your output must be read-only advisory guidance. Never place a bid, award an auction, approve or reject identity, modify deposits, resolve disputes, expose private participant data, or change records.",
    "Do not invent authority or claim a verified conclusion. Label facts as 'System verified' when they come from supplied context.",
    "Use only supplied context and source links. When data is missing, state that it is unavailable rather than inferring it.",
    "Separate evidence from conclusions. If deterministic rules produce an anomaly flag, report it as authoritative evidence and explain that the human reviewer must make the final decision.",
    modeSpecific,
    "Source links:",
    sourceList,
    "Verified context:",
    input.verifiedContext,
    `User request: ${input.prompt}`,
  ].join("\n\n");
}
