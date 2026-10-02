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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t("dashboard.quickLinks")}</CardTitle>
            <CardDescription>{t("dashboard.quickLinksDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <QuickLink to="/auctions" label={t("dashboard.browse")} />
            <QuickLink to="/app/kyc" label={t("dashboard.verify")} />
            <QuickLink to="/app/notifications" label={t("dashboard.notifications")} />
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
