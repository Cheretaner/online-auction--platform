import type { OrgType } from "@auction/shared";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  orgType: OrgType;
  taxpayerId: string;
  region: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  isActive: boolean;
  onboardedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
