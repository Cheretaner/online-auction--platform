import type { Role } from "@auction/shared";
import { intlLocale } from "@/i18n/core";
import { translate, translateValue } from "@/i18n/context";

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

/** Amounts keep Western digits in both languages; only the currency word changes (ETB / ብር). */
export function formatMoney(value: string | null | undefined, currency?: string) {
  if (!value) return "—";
  const unit = currency ?? translate("common", "currency");
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${unit} ${value}`;
  return new Intl.NumberFormat("en-ET", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ` ${unit}`;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  // Gregorian calendar with localized month names; 24-hour clock avoids the
  // Ethiopian 12-hour day-count ambiguity for deadlines.
  return new Intl.DateTimeFormat(intlLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
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

/** Display label for any API status, role or enum value, in the current language. */
export function statusLabel(value: string) {
  const asStatus = translateValue("status", value);
  if (asStatus !== value.replaceAll("_", " ")) return asStatus;
  return translateValue("enums", value);
}

/** Display label for an API enum (auction type, document type, role…). */
export function enumLabel(value: string) {
  return translateValue("enums", value);
}

/** Region names are stored in English; show them in the current language when known. */
export function regionLabel(value: string | null | undefined) {
  if (!value) return "";
  return translateValue("regions", value);
}
