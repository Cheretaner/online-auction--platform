import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { useAuth } from "@/features/auth/auth-provider";
import { usePublicAuctions } from "@/features/auctions/queries";
import { useMyDeposits, useMyVerification, useUnreadCount } from "@/features/operations/queries";
import { canManageAuctions } from "@/lib/format";

export default function DashboardPage() {
  const { session, roles, organizationId } = useAuth();
  const auctions = usePublicAuctions();
  const verification = useMyVerification();
  const deposits = useMyDeposits();
  const unread = useUnreadCount();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session?.user.fullName ?? "there"}`}
        description="This workspace talks only to the production API. Organization-scoped actions require an org context on your access token."
        actions={
          canManageAuctions(roles) ? (
            <Button asChild>
              <Link to="/app/auctions/new">New auction</Link>
            </Button>
          ) : null
        }
      />
      {!organizationId && (session?.organizations.length ?? 0) > 1 ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Select an organization in the header. The API returns 403 ORG_CONTEXT_REQUIRED until you do.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Public lots" value={String(auctions.data?.items.length ?? "—")} />
        <Stat title="KYC" value={verification.data?.status ?? session?.user.verificationStatus ?? "—"} />
        <Stat title="My deposits" value={String(deposits.data?.items.length ?? "—")} />
        <Stat title="Unread" value={String(unread.data?.count ?? 0)} />
      </div>
      <QueryState isLoading={auctions.isLoading} isError={auctions.isError} error={auctions.error} isEmpty={false}>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Roles on this token</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm">
              {roles.length ? roles.map((role) => <span key={role} className="rounded-md bg-muted px-2 py-1">{role}</span>) : "No roles"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Link className="text-primary underline" to="/auctions">
                Public catalogue
              </Link>
              <Link className="text-primary underline" to="/app/kyc">
                Verification
              </Link>
              <Link className="text-primary underline" to="/app/notifications">
                Notifications
              </Link>
            </CardContent>
          </Card>
        </div>
      </QueryState>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-semibold capitalize">{value}</p>
      </CardContent>
    </Card>
  );
}
