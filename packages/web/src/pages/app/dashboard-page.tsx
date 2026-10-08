import { ArrowRight, Bell, Bookmark, Building2, CheckCircle2, CircleAlert, Gavel, Plus, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/query-state";
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
import { useT } from "@/i18n/context";

export default function DashboardPage() {
  const { session, roles, organizationId } = useAuth();
  const auctions = usePublicAuctions({ status: "live", limit: 1 });
  const verification = useMyVerification();
  const deposits = useMyDeposits();
  const unread = useUnreadCount();
  const t = useT("workspace");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.welcome", { name: session?.user.fullName.split(" ")[0] ?? t("dashboard.there") })}
        description={t("dashboard.description")}
        actions={
          canManageAuctions(roles) ? (
            <Button asChild>
              <Link to="/app/auctions/new">
                <Plus aria-hidden /> {t("dashboard.createAuction")}
              </Link>
            </Button>
          ) : null
        }
      />

      {!organizationId && (session?.organizations.length ?? 0) > 1 ? (
        <Alert variant="warning">
          <Building2 aria-hidden />
          <AlertDescription className="text-foreground">
            {t("dashboard.chooseOrg")}
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label={t("dashboard.overview")}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label={t("dashboard.liveAuctions")}
          value={auctions.data ? String(auctions.data.total) : "—"}
          hint={t("dashboard.liveHint")}
          icon={Gavel}
          href="/auctions?status=live"
          loading={auctions.isLoading}
        />
        <StatCard
          label={t("dashboard.identity")}
          value={statusLabel(
            verification.data?.status ??
            session?.user.verificationStatus ??
            "unverified",
          )}
          hint={t("dashboard.identityHint")}
          icon={CheckCircle2}
          href="/app/kyc"
          loading={verification.isLoading}
        />
        <StatCard
          label={t("dashboard.deposits")}
          value={deposits.data ? String(deposits.data.items.length) : "—"}
          hint={t("dashboard.depositsHint")}
          icon={Wallet}
          href="/app/deposits"
          loading={deposits.isLoading}
        />
        <StatCard
          label={t("dashboard.unread")}
          value={unread.data ? String(unread.data.count) : "—"}
          hint={t("dashboard.unreadHint")}
          icon={Bell}
          href="/app/notifications"
          loading={unread.isLoading}
        />
      </section>

      {auctions.isError || verification.isError || deposits.isError || unread.isError ? (
        <section className="space-y-3" aria-label={t("dashboard.dataIssues")}>
          <Alert variant="warning">
            <CircleAlert aria-hidden />
            <AlertDescription>{t("dashboard.dataIssuesDescription")}</AlertDescription>
          </Alert>
          {auctions.isError ? <ErrorState error={auctions.error} onRetry={() => void auctions.refetch()} /> : null}
          {verification.isError ? <ErrorState error={verification.error} onRetry={() => void verification.refetch()} /> : null}
          {deposits.isError ? <ErrorState error={deposits.error} onRetry={() => void deposits.refetch()} /> : null}
          {unread.isError ? <ErrorState error={unread.error} onRetry={() => void unread.refetch()} /> : null}
        </section>
      ) : null}

      <div className="flex w-full justify-around gap-8">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t("dashboard.access")}</CardTitle>
            <CardDescription>
              {t("dashboard.accessDescription")}
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
                {t("dashboard.noRoles")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex-1">
          <CardHeader>
            <CardTitle>{t("dashboard.quickLinks")}</CardTitle>
            <CardDescription>{t("dashboard.quickLinksDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <QuickLink to="/auctions" label={t("dashboard.browse")} />
            <QuickLink to="/app/kyc" label={t("dashboard.verify")} />
            <QuickLink to="/app/notifications" label={t("dashboard.notifications")} />
            <QuickLink to="/app/watchlist" label={t("dashboard.watchlist")} icon={Bookmark} />
            {organizationId && roles.some((role) => ["auction_officer", "org_admin", "compliance_officer", "super_admin"].includes(role)) ? (
              <QuickLink to="/app/auctions" label={t("dashboard.workspaceAuctions")} icon={Gavel} />
            ) : null}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function QuickLink({ to, label, icon: Icon = ArrowRight }: { to: string; label: string; icon?: typeof ArrowRight }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      <span>{label}</span>
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
