import { ArrowRight, Bell, Building2, CheckCircle2, Gavel, Plus, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { usePublicAuctions } from "@/features/auctions/queries";
import {
  useMyDeposits,
  useMyVerification,
  useUnreadCount,
} from "@/features/operations/queries";
import { canManageAuctions, statusLabel } from "@/lib/format";

export default function DashboardPage() {
  const { session, roles, organizationId } = useAuth();
  const auctions = usePublicAuctions({ status: "live", limit: 1 });
  const verification = useMyVerification();
  const deposits = useMyDeposits();
  const unread = useUnreadCount();

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${session?.user.fullName.split(" ")[0] ?? "there"}`}
        description="Your account, eligibility, and activity across Cheretanet auctions."
        actions={
          canManageAuctions(roles) ? (
            <Button asChild>
              <Link to="/app/auctions/new">
                <Plus aria-hidden /> Create auction
              </Link>
            </Button>
          ) : null
        }
      />

      {!organizationId && (session?.organizations.length ?? 0) > 1 ? (
        <Alert variant="warning">
          <Building2 aria-hidden />
          <AlertDescription className="text-foreground">
            Choose an organization in the top bar to manage its auctions and complete organization actions.
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label="Account overview"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Live auctions"
          value={auctions.data ? String(auctions.data.total) : "—"}
          hint="Open for bidding now"
          icon={Gavel}
          href="/auctions?status=live"
          loading={auctions.isLoading}
        />
        <StatCard
          label="Identity check"
          value={statusLabel(
            verification.data?.status ??
              session?.user.verificationStatus ??
              "unverified",
          )}
          hint="Review your verification"
          icon={CheckCircle2}
          href="/app/kyc"
          loading={verification.isLoading}
        />
        <StatCard
          label="My deposits"
          value={deposits.data ? String(deposits.data.items.length) : "—"}
          hint="Review deposit records"
          icon={Wallet}
          href="/app/deposits"
          loading={deposits.isLoading}
        />
        <StatCard
          label="Unread messages"
          value={unread.data ? String(unread.data.count) : "—"}
          hint="Open notifications"
          icon={Bell}
          href="/app/notifications"
          loading={unread.isLoading}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Your access</CardTitle>
            <CardDescription>
              Permissions available to your current account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roles.length ? (
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary" className="capitalize">
                    {statusLabel(role)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No organization roles are assigned to this account yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Pick up where you need to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <QuickLink to="/auctions" label="Browse public auctions" />
            <QuickLink to="/app/kyc" label="Identity verification" />
            <QuickLink to="/app/notifications" label="Notifications" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      <span>{label}</span>
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
