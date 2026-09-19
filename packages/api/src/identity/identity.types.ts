import { RegisterRequest, LoginRequest, UpdateProfileRequest } from "@auction/shared";
import type { Role, AccountType, VerificationStatus } from "@auction/shared";

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  phone: string | null;
  accountType: AccountType;
  businessName: string | null;
  nationalId: string | null;
  tinNumber: string | null;
  region: string | null;
  verificationStatus: VerificationStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  assignedAt: string;
}
