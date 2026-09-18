import type { Role } from "@auction/shared";

// DB storage now uses the same role strings as the app-level `Role` type
// (see organization_members_role_check in the 001 migration). The legacy
// "organization_admin" alias is kept here only so rows written before the
// naming was unified still map correctly.
const DB_TO_APP: Record<string, Role> = {
  org_admin: "org_admin",
  organization_admin: "org_admin",
  auction_officer: "auction_officer",
  compliance_officer: "compliance_officer",
  bidder: "bidder",
  guest: "guest",
  super_admin: "super_admin",
};

export function mapDbRole(role: string): Role {
  return DB_TO_APP[role] ?? "bidder";
}

export function primaryActorRole(roles: Role[]): Role {
  const rank: Role[] = [
    "super_admin",
    "org_admin",
    "compliance_officer",
    "auction_officer",
    "bidder",
    "guest",
  ];
  return rank.find((role) => roles.includes(role)) ?? "bidder";
}

export function isOfficerRole(role: Role | string): boolean {
  return (
    role === "org_admin" ||
    role === "auction_officer" ||
    role === "compliance_officer" ||
    role === "super_admin"
  );
}
