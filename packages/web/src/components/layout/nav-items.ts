import type { Role } from "@auction/shared";
import {
  Bell,
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
  Radar,
} from "lucide-react";
import { hasRole, isOfficer } from "@/lib/format";

export type NavGroup = "Overview" | "Participation" | "Manage" | "Oversight" | "Tools" | "Account";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  group: NavGroup;
  roles?: Role[];
  match?: "exact" | "prefix";
}

/** Sidebar section order. */
export const NAV_GROUPS: NavGroup[] = ["Overview", "Participation", "Manage", "Oversight", "Tools", "Account"];

export function getAppNav(roles: Role[]): NavItem[] {
  const items: NavItem[] = [
    { to: "/app", label: "Overview", icon: LayoutDashboard, group: "Overview", match: "exact" },
    { to: "/app/notifications", label: "Notifications", icon: Bell, group: "Overview" },
    { to: "/app/kyc", label: "Identity (KYC)", icon: Shield, group: "Participation", match: "exact" },
    { to: "/app/deposits", label: "Deposits", icon: Wallet, group: "Participation" },
    { to: "/app/documents", label: "Documents", icon: FolderOpen, group: "Participation" },
    { to: "/app/disputes", label: "Disputes", icon: Scale, group: "Participation" },
    { to: "/app/auctions", label: "Workspace auctions", icon: Gavel, group: "Manage", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/autofetch", label: "AutoFetch", icon: Radar, group: "Manage", roles: ["org_admin", "compliance_officer", "auction_officer"] },
    { to: "/app/organizations", label: "Organizations", icon: Building2, group: "Manage", roles: ["org_admin", "super_admin"] },
    { to: "/app/categories", label: "Categories", icon: Landmark, group: "Manage", roles: ["super_admin"] },
    { to: "/app/kyc/review", label: "KYC review", icon: ShieldCheck, group: "Oversight", roles: ["compliance_officer", "org_admin", "super_admin"] },
    { to: "/app/ai", label: "Anomaly review", icon: ScanSearch, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/reports", label: "Reports", icon: FileText, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/audit", label: "Audit ledger", icon: ScrollText, group: "Oversight", roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/ai-assistant", label: "AI assistant", icon: Sparkles, group: "Tools" },
    { to: "/app/telegram", label: "Telegram", icon: Send, group: "Tools" },
    { to: "/app/profile", label: "Profile", icon: UserRound, group: "Account" },
  ];

  return items.filter((item) => {
    if (!item.roles) return true;
    if (item.to === "/app/autofetch") return isOfficer(roles) && hasRole(roles, ...item.roles);
    return hasRole(roles, ...item.roles);
  });
}
