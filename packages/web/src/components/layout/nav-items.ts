import type { Role } from "@auction/shared";
import {
  Bell,
  Bookmark,
  Building2,
  FileText,
  Gavel,
  Home,
  Landmark,
  LayoutDashboard,
  Scale,
  ScrollText,
  Shield,
  ShieldCheck,
  ScanSearch,
  Sparkles,
  Send,
  UserRound,
  Wallet,
  FolderOpen,
  Radar,  ListChecks,} from "lucide-react";
import { hasRole, isOfficer } from "@/lib/format";

export type NavGroup = "Overview" | "Participation" | "Manage" | "Oversight" | "Tools" | "Account";

/** Keys into the `layout.nav` dictionary. */
export type NavLabel =
  | "overview"
  | "notifications"
  | "kyc"
  | "deposits"
  | "watchlist"
  | "documents"
  | "disputes"
  | "workspaceAuctions"
  | "autofetch"
  | "organizations"
  | "categories"
  | "kycReview"
  | "anomalyReview"
  | "reports"
  | "audit"
  | "aiAssistant"
  | "exceptions"
  | "telegram"
  | "profile";

export interface NavItem {
  to: string;
  label: NavLabel;
  icon: typeof Home;
  group: NavGroup;
  roles?: Role[];
  match?: "exact" | "prefix";
}

/** Sidebar section order. */
export const NAV_GROUPS: NavGroup[] = ["Overview", "Participation", "Manage", "Oversight", "Tools", "Account"];

export function getAppNav(roles: Role[]): NavItem[] {
  const items: NavItem[] = [
    { to: "/app", label: "overview", icon: LayoutDashboard, group: "Overview", match: "exact" },
    { to: "/app/notifications", label: "notifications", icon: Bell, group: "Overview" },
    { to: "/app/kyc", label: "kyc", icon: Shield, group: "Participation", match: "exact" },
    { to: "/app/deposits", label: "deposits", icon: Wallet, group: "Participation" },
    { to: "/app/watchlist", label: "watchlist", icon: Bookmark, group: "Participation" },
    { to: "/app/documents", label: "documents", icon: FolderOpen, group: "Participation" },
    { to: "/app/disputes", label: "disputes", icon: Scale, group: "Participation" },
    { to: "/app/auctions", label: "workspaceAuctions", icon: Gavel, group: "Manage", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/autofetch", label: "autofetch", icon: Radar, group: "Manage", roles: ["org_admin", "compliance_officer", "auction_officer"] },
    { to: "/app/organizations", label: "organizations", icon: Building2, group: "Manage", roles: ["org_admin", "super_admin"] },
    { to: "/app/categories", label: "categories", icon: Landmark, group: "Manage", roles: ["super_admin"] },
    { to: "/app/kyc/review", label: "kycReview", icon: ShieldCheck, group: "Oversight", roles: ["compliance_officer", "org_admin", "super_admin"] },
    { to: "/app/ai", label: "anomalyReview", icon: ScanSearch, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/reports", label: "reports", icon: FileText, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/audit", label: "audit", icon: ScrollText, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/exceptions", label: "exceptions", icon: ListChecks, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/ai-assistant", label: "aiAssistant", icon: Sparkles, group: "Tools" },
    { to: "/app/telegram", label: "telegram", icon: Send, group: "Tools" },
    { to: "/app/profile", label: "profile", icon: UserRound, group: "Account" },
  ];

  return items.filter((item) => {
    if (!item.roles) return true;
    if (item.to === "/app/autofetch") return isOfficer(roles) && hasRole(roles, ...item.roles);
    return hasRole(roles, ...item.roles);
  });
}
