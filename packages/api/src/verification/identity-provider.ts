import type { VerificationDocumentType } from "@auction/shared";

export interface IdentityProviderInput {
  documentType: VerificationDocumentType;
  documentNumber: string;
  evidenceDocumentId: string;
}

export interface IdentityProviderResult {
  provider: string;
  outcome: "manual_review";
  reference: string | null;
}

export interface IdentityVerificationProvider {
  precheck(input: IdentityProviderInput): Promise<IdentityProviderResult>;
}

/** Default until NIDP/Faydaverse or a licensed provider grants API access. */
export class ManualReviewIdentityProvider implements IdentityVerificationProvider {
  async precheck(_input: IdentityProviderInput): Promise<IdentityProviderResult> {
    return { provider: "manual", outcome: "manual_review", reference: null };
  }
}