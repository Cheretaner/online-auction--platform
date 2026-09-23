import type { Role } from "@auction/shared";

export const OFFICER_ROLES: Role[] = [
  "auction_officer",
  "org_admin",
  "compliance_officer",
  "super_admin",
];

export function hasRole(roles: Role[], ...needed: Role[]) {
  return needed.some((role) => roles.includes(role));
}

export function isOfficer(roles: Role[]) {
  return hasRole(roles, ...OFFICER_ROLES);
}

export function canManageAuctions(roles: Role[]) {
  return hasRole(roles, "auction_officer", "org_admin", "super_admin");
}

export function canApproveAuctions(roles: Role[]) {
  return hasRole(roles, "org_admin", "compliance_officer", "super_admin");
}

export function canReviewKyc(roles: Role[]) {
  return hasRole(roles, "compliance_officer", "org_admin", "super_admin");
}

export function canManageOrg(roles: Role[]) {
  return hasRole(roles, "org_admin", "super_admin");
}

export function canUseAutofetch(roles: Role[]) {
  return hasRole(roles, "org_admin", "compliance_officer", "auction_officer");
}

export function formatMoney(value: string | null | undefined, currency = "ETB") {
  if (!value) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat("en-ET", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ` ${currency}`;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}
