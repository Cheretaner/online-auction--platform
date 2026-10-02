import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/auth-provider";
import { useLogout } from "@/features/auth/queries";
import { useT } from "@/i18n/context";

export function UserMenu() {
  const { session, isAuthenticated } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useT("layout");
  const inWorkspace = pathname.startsWith("/app");

  if (!isAuthenticated || !session) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">{t("user.signIn")}</Link>
      </Button>
    );
  }

  const initials = session.user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2" aria-label={t("user.accountMenu", { name: session.user.fullName })}>
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium xl:inline">{session.user.fullName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{session.user.fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">{session.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {inWorkspace ? null : (
          <DropdownMenuItem asChild>
            <Link to="/app">
              <LayoutDashboard />
              {t("user.workspace")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/app/profile">
            <UserRound />
            {t("user.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          <LogOut />
          {t("user.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
