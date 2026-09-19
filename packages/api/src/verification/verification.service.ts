import { VerificationRepository } from "./verification.repository.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { SubmitVerificationRequest, ReviewVerificationRequest } from "@auction/shared";
import { IdentityRepository } from "../identity/identity.repository.js";

export class VerificationService {
  private repository = new VerificationRepository();
  private identityRepo = new IdentityRepository();

  async submit(userId: string, data: SubmitVerificationRequest) {
    const existingPending = await this.repository.getPendingVerification(userId);
    if (existingPending) {
      throw new AppError("A pending verification already exists", HttpStatus.BAD_REQUEST);
    }
    
    return await this.repository.createVerification(userId, data);
  }

  async review(adminId: string, verificationId: string, data: ReviewVerificationRequest) {
    let newStatus: 'verified' | 'rejected' = 'rejected';
    if (data.decision === 'approved') {
      newStatus = 'verified';
    }
    return await this.repository.reviewVerification(adminId, verificationId, {
      status: newStatus,
      decision: data.decision,
      decisionReason: data.decisionReason
    });
  }

  async listPending() {
    const pending = await this.repository.listPendingVerifications();
    return pending;
  }

  async checkDuplicates(userId: string) {
    const profile = await this.identityRepo.findProfileById(userId);
    if (!profile) return { hasDuplicates: false };

    const duplicates = await this.repository.checkDuplicateNationalIdOrTin(
      profile.nationalId, 
      profile.tinNumber
    );

    const otherDuplicates = duplicates.filter(d => d.id !== userId);
    
    return {
      hasDuplicates: otherDuplicates.length > 0,
      duplicates: otherDuplicates
    };
  }
}
