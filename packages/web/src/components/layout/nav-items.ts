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
  Sparkles,
  Send,
  UserRound,
  Wallet,
  FolderOpen,
  Radar,
} from "lucide-react";
import { hasRole, isOfficer } from "@/lib/format";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  roles?: Role[];
  match?: "exact" | "prefix";
}

export function getAppNav(roles: Role[]): NavItem[] {
  const items: NavItem[] = [
    { to: "/app", label: "Overview", icon: LayoutDashboard, match: "exact" },
    { to: "/app/auctions", label: "Workspace auctions", icon: Gavel, roles: ["auction_officer", "org_admin", "super_admin"] },
    { to: "/app/kyc", label: "KYC", icon: Shield },
    { to: "/app/deposits", label: "Deposits", icon: Wallet },
    { to: "/app/documents", label: "Documents", icon: FolderOpen },
    { to: "/app/notifications", label: "Notifications", icon: Bell },
    { to: "/app/disputes", label: "Disputes", icon: Scale },
    { to: "/app/reports", label: "Reports", icon: FileText, roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/audit", label: "Audit", icon: ScrollText, roles: ["auction_officer", "org_admin", "compliance_officer", "super_admin"] },
    { to: "/app/ai", label: "AI", icon: Sparkles },
    { to: "/app/telegram", label: "Telegram", icon: Send },
    { to: "/app/autofetch", label: "AutoFetch", icon: Radar, roles: ["org_admin", "compliance_officer", "auction_officer"] },
    { to: "/app/organizations", label: "Organizations", icon: Building2, roles: ["super_admin"] },
    { to: "/app/categories", label: "Categories", icon: Landmark, roles: ["super_admin"] },
    { to: "/app/profile", label: "Profile", icon: UserRound },
  ];

  return items.filter((item) => {
    if (!item.roles) return true;
    if (item.to === "/app/autofetch") return isOfficer(roles) && hasRole(roles, ...item.roles);
    return hasRole(roles, ...item.roles);
  });
}
