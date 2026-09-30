import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRight, Bell, CheckCircle2, Gavel } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
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
        title={`Welcome, ${session?.user.fullName ?? "there"}`}
        description="Your account, eligibility, and activity across Cheretanet auctions."
        actions={
          canManageAuctions(roles) ? (
            <Button asChild>
              <Link to="/app/auctions/new">Create auction</Link>
            </Button>
          ) : null
        }
      />

      {!organizationId && (session?.organizations.length ?? 0) > 1 ? (
        <div className="rounded-xl border border-accent bg-accent/40 px-4 py-3 text-sm text-accent-foreground">
          Select an organization above to manage its auctions and complete
          organization-scoped actions.
        </div>
      ) : null}

      <section
        aria-label="Account overview"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Stat
          title="Live auctions"
          value={auctions.data ? String(auctions.data.total) : "—"}
          hint="Open for bidding now"
          icon={Gavel}
          href="/auctions?status=live"
          loading={auctions.isLoading}
        />
        <Stat
          title="Identity check"
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
        <Stat
          title="My deposits"
          value={deposits.data ? String(deposits.data.items.length) : "—"}
          hint="Review deposit records"
          icon={Activity}
          href="/app/deposits"
          loading={deposits.isLoading}
        />
        <Stat
          title="Unread messages"
          value={unread.data ? String(unread.data.count) : "—"}
          hint="Open notifications"
          icon={Bell}
          href="/app/notifications"
          loading={unread.isLoading}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
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
                  <Badge key={role} variant="secondary">
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

function Stat({
  title,
  value,
  hint,
  icon: Icon,
  href,
  loading,
}: {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  loading: boolean;
}) {
  return (
    <Link to={href} className="group rounded-2xl focus-visible:outline-none">
      <Card
        aria-busy={loading}
        className="h-full transition-colors group-hover:border-primary/40 group-focus-visible:border-primary"
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-2 text-2xl font-semibold capitalize tracking-tight">
                {value}
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>{hint}</span>
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      <span>{label}</span>
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
