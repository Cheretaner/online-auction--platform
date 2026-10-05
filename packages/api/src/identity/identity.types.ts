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
  preferredLanguage: "en" | "am" | null;
  verificationStatus: VerificationStatus;
  platformRole: Role | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Profile with the password hash stripped — the only shape sent over HTTP. */
export type PublicProfile = Omit<Profile, "passwordHash" | "nationalId" | "tinNumber">;

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  role: Role;
}

export interface AuthSession {
  user: PublicProfile;
  roles: Role[];
  organizationId: string | null;
  organizations: OrganizationMembership[];
  token: string;
  refreshToken: string;
  expiresIn: string;
}
