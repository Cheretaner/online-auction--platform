import type { Role } from "@auction/shared";
import { ROLES } from "@auction/shared";

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

/** Normalises and de-duplicates a set of raw role strings from the database. */
export function mapDbRoles(roles: string[]): Role[] {
  return [...new Set(roles.map(mapDbRole))];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
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

export function hasOfficerRole(roles: Array<Role | string>): boolean {
  return roles.some(isOfficerRole);
}
