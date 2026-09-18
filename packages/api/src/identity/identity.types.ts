import type { Role } from "@auction/shared";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  verified: boolean;
  roles: Role[];
  organizationId?: string;
}

export interface AuthTokens {
  accessToken: string;
  user: UserRecord;
}
