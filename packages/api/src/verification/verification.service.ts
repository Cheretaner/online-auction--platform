import type { ReviewVerificationRequest, Role, SubmitVerificationRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import { IdentityRepository } from "../identity/identity.repository.js";
import * as notifications from "../notification/notification.service.js";
import { VerificationRepository } from "./verification.repository.js";
import type { Verification } from "./verification.types.js";
import * as documentService from "../document/document.service.js";
import { ManualReviewIdentityProvider, type IdentityVerificationProvider } from "./identity-provider.js";

export class VerificationService {
  private repository = new VerificationRepository();
  private identityRepo = new IdentityRepository();
  constructor(private readonly identityProvider: IdentityVerificationProvider = new ManualReviewIdentityProvider()) {}

  async submit(user: { userId: string; roles: Role[] }, data: SubmitVerificationRequest): Promise<Verification> {
    const evidence = await documentService.getDocument(data.documentId);
    if (
      !evidence ||
      evidence.uploadedBy !== user.userId ||
      !evidence.isPrivate ||
      evidence.documentType !== "identity_document"
    ) {
      throw AppError.badRequest("KYC evidence must be a private document uploaded by you");
    }
    const screening = await this.identityProvider.precheck({
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      evidenceDocumentId: data.documentId,
    });
    const existingPending = await this.repository.getPendingVerification(user.userId);
    if (existingPending) {
      throw AppError.conflict("A pending verification already exists");
    }
    const verification = await this.repository.createVerification(user.userId, data);
    await audit.appendAuditEvent({
      auctionId: null,
      actorId: user.userId,
      actorRole: audit.actorRoleOf(user.roles),
      entityType: "verification",
      entityId: verification.id,
      action: "verification.submitted",
      payload: {
        documentType: verification.documentType,
        documentId: evidence.id,
        evidenceChecksumSha256: evidence.checksumSha256,
        provider: screening.provider,
        providerOutcome: screening.outcome,
        providerReference: screening.reference,
      },
    });
    return verification;
  }

  async review(
    reviewer: { userId: string; roles: Role[] },
    verificationId: string,
    data: ReviewVerificationRequest,
  ): Promise<Verification> {
    const existing = await this.repository.findById(verificationId);
    if (!existing) {
      throw new AppError("Verification not found", HttpStatus.NOT_FOUND);
    }
    if (existing.status !== "pending") {
      throw AppError.unprocessable(`Verification has already been ${existing.status}`);
    }

    // A reviewer must never sign off on their own KYC submission — the same
    // separation-of-duties principle as the auction two-person rule.
    if (existing.userId === reviewer.userId) {
      throw AppError.unprocessable(
        "You cannot review your own verification",
        "APPROVAL_SELF",
      );
    }

    const newStatus: "verified" | "rejected" = data.decision === "approved" ? "verified" : "rejected";

    const updated = await this.repository.reviewVerification(reviewer.userId, verificationId, {
      status: newStatus,
      decision: data.decision,
      decisionReason: data.decisionReason,
    });

    // KYC decisions gate who may bid, so they belong in the tamper-evident
    // ledger even though they are not scoped to a single auction.
    await audit.appendAuditEvent({
      auctionId: null,
      actorId: reviewer.userId,
      actorRole: audit.actorRoleOf(reviewer.roles),
      entityType: "verification",
      entityId: updated.id,
      action: `verification.${data.decision}`,
      payload: { subjectUserId: updated.userId, status: newStatus },
    });

    await notifications.enqueueNotification({
      userId: updated.userId,
      channel: "in_app",
      type: "verification.reviewed",
      title: newStatus === "verified" ? "Your account is verified" : "Verification was not approved",
      message:
        data.decisionReason ??
        (newStatus === "verified"
          ? "You can now place bids on auctions you are eligible for."
          : "Please review your submission and try again."),
      relatedEntityType: "verification",
      relatedEntityId: updated.id,
    });

    return updated;
  }

  async listPending(): Promise<Verification[]> {
    return this.repository.listPendingVerifications();
  }

  async getLatestFor(userId: string): Promise<Verification | null> {
    return this.repository.findLatestForUser(userId);
  }

  async checkDuplicates(userId: string) {
    const profile = await this.identityRepo.findProfileById(userId);
    if (!profile) {
      throw new AppError("Profile not found", HttpStatus.NOT_FOUND);
    }

    const duplicates = await this.repository.checkDuplicateNationalIdOrTin(
      profile.nationalId,
      profile.tinNumber,
    );

    const otherDuplicates = duplicates.filter((row) => row.id !== userId);

    return {
      hasDuplicates: otherDuplicates.length > 0,
      duplicates: otherDuplicates,
    };
  }
}
