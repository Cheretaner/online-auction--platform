import type { Role } from "@auction/shared";

const DB_TO_APP: Record<string, Role> = {
  organization_admin: "org_admin",
  auction_officer: "auction_officer",
  compliance_officer: "compliance_officer",
  bidder: "bidder",
  guest: "guest",
  super_admin: "super_admin",
  org_admin: "org_admin",
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
    role === "organization_admin" ||
    role === "auction_officer" ||
    role === "compliance_officer" ||
    role === "super_admin"
  );
}
