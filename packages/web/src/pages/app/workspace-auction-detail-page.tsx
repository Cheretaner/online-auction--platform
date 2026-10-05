import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, ErrorState, PageSkeleton, QueryState } from "@/components/feedback/query-state";
import { ExternalLink, Pencil, ScanSearch, Scale, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnomalyList } from "@/features/anomalies/anomaly-list";
import { useAuction, useAuctionAction } from "@/features/auctions/queries";
import { useAuth } from "@/features/auth/auth-provider";
import { DisputeList } from "@/features/disputes/dispute-list";
import { AuctionDocuments } from "@/features/documents/auction-documents";
import { useAiAnomalies } from "@/features/ai/queries";
import { useDisputes } from "@/features/operations/queries";
import { CompliancePanel } from "@/features/workspace/compliance-panel";
import { DepositReview } from "@/features/workspace/deposit-review";
import { LotsManager } from "@/features/workspace/lots-manager";
import { HistoricalInsights } from "@/features/workspace/historical-insights";
import { ReportsPanel } from "@/features/workspace/reports-panel";
import { SealedOpeningCeremony } from "@/features/workspace/sealed-opening-ceremony";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { canApproveAuctions, canManageAuctions, enumLabel, formatDateTime, formatMoney, hasRole, regionLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

const CANCELLABLE = new Set(["draft", "pending_review", "scheduled", "live", "closed", "under_review"]);
const AWARDABLE = new Set(["closed", "under_review"]);

export default function WorkspaceAuctionDetailPage() {
  const { id } = useParams();
  const auction = useAuction(id);
  const record = auction.data;
  const t = useT("workspace");
  return (
    <div>
      <PageHeader
        back={{ to: "/app/auctions", label: t("detail.back") }}
        title={record?.title ?? t("detail.fallbackTitle")}
        meta={
          record ? (
            <>
              <StatusBadge status={record.status} />
              <Badge variant="outline">{enumLabel(record.auctionType)}</Badge>
            </>
          ) : null
        }
        actions={
          record ? (
            <>
              {record.status === "draft" ? (
                <Button asChild variant="outline">
                  <Link to={`/app/auctions/${record.id}/edit`}>
                    <Pencil aria-hidden /> {t("detail.edit")}
                  </Link>
                </Button>
              ) : null}
              {record.status !== "draft" && record.status !== "pending_review" ? (
                <Button asChild variant="outline">
                  <Link to={`/auctions/${record.id}`}>
                    <ExternalLink aria-hidden /> {t("detail.publicPage")}
                  </Link>
                </Button>
              ) : null}
            </>
          ) : null
        }
      />
      <QueryState
        isLoading={auction.isLoading}
        isError={auction.isError}
        error={auction.error}
        onRetry={() => void auction.refetch()}
      >
        {record ? <Workspace auction={record} /> : null}
      </QueryState>
    </div>
  );
}

function Workspace({ auction }: { auction: Auction }) {
  const { roles } = useAuth();
  const anomalies = useAiAnomalies(auction.id);
  const disputes = useDisputes(auction.id);
  const openFlags = (anomalies.data?.items ?? []).filter((flag) => flag.status === "open").length;
  const openDisputes = (disputes.data?.items ?? []).filter((d) => d.status === "open" || d.status === "under_review").length;
  const reviewer = hasRole(roles, "compliance_officer", "org_admin", "super_admin");
  const canViewInsights = hasRole(roles, "auction_officer", "org_admin", "compliance_officer", "super_admin");
  const t = useT("workspace");

  return (
    <div className="space-y-6">
      <LifecycleActions auction={auction} />
      {auction.auctionType === "sealed_bid" ? <SealedOpeningCeremony auction={auction} /> : null}
      <Overview auction={auction} />
      {canViewInsights ? <HistoricalInsights auctionId={auction.id} /> : null}
      <Tabs defaultValue="lots">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="lots">{t("detail.tabs.lots")}</TabsTrigger>
            <TabsTrigger value="documents">{t("detail.tabs.documents")}</TabsTrigger>
            <TabsTrigger value="deposits">{t("detail.tabs.deposits")}</TabsTrigger>
            <TabsTrigger value="compliance">{t("detail.tabs.compliance")}</TabsTrigger>
            <TabsTrigger value="anomalies">
              {t("detail.tabs.anomalies")}
              {!anomalies.isLoading && openFlags ? <Badge variant="warning" className="px-1.5">{openFlags}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="disputes">
              {t("detail.tabs.disputes")}
              {!disputes.isLoading && openDisputes ? <Badge variant="warning" className="px-1.5">{openDisputes}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="reports">{t("detail.tabs.reports")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="lots" className="pt-4">
          <LotsManager auctionId={auction.id} editable={auction.status === "draft" && canManageAuctions(roles)} />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <AuctionDocuments auctionId={auction.id} canUpload canReview />
        </TabsContent>
        <TabsContent value="deposits" className="pt-4">
          {Number(auction.depositAmount) > 0 ? (
            <DepositReview auction={auction} />
          ) : (
            <EmptyState size="inline" icon={ShieldCheck} title={t("detail.noBidSecurity")} />
          )}
        </TabsContent>
        <TabsContent value="compliance" className="pt-4">
          <CompliancePanel auctionId={auction.id} canRun={reviewer} />
        </TabsContent>
        <TabsContent value="anomalies" className="pt-4">
          {anomalies.isLoading ? <PageSkeleton rows={2} /> : anomalies.isError ? (
            <ErrorState error={anomalies.error} onRetry={() => void anomalies.refetch()} />
          ) : (anomalies.data?.items ?? []).length === 0 ? (
            <EmptyState size="inline" icon={ScanSearch} title={t("detail.noFlags")} />
          ) : (
            <AnomalyList items={anomalies.data?.items ?? []} showAuctionLink={false} />
          )}
        </TabsContent>
        <TabsContent value="disputes" className="pt-4">
          {disputes.isLoading ? <PageSkeleton rows={2} /> : disputes.isError ? (
            <ErrorState error={disputes.error} onRetry={() => void disputes.refetch()} />
          ) : (disputes.data?.items ?? []).length === 0 ? (
            <EmptyState size="inline" icon={Scale} title={t("detail.noDisputes")} />
          ) : (
            <DisputeList items={disputes.data?.items ?? []} showAuctionLink={false} />
          )}
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <ReportsPanel auctionId={auction.id} canPublish={reviewer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Overview({ auction }: { auction: Auction }) {
  const t = useT("workspace");
  const tc = useT("common");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.overview")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label={t("detail.auctionType")} value={enumLabel(auction.auctionType)} />
        <Info label={t("detail.startingPrice")} value={formatMoney(auction.startPrice)} />
        <Info label={t("detail.minIncrement")} value={formatMoney(auction.minIncrement)} />
        <Info label={t("detail.reserve")} value={auction.reservePrice ? formatMoney(auction.reservePrice) : tc("none")} />
        <Info
          label={t("detail.highestBid")}
          value={Number(auction.currentHighestBid ?? 0) > 0 ? formatMoney(auction.currentHighestBid) : t("detail.noBidsYet")}
        />
        <Info label={t("detail.bids")} value={String(auction.bidCount)} />
        <Info
          label={t("detail.deposit")}
          value={Number(auction.depositAmount) > 0 ? formatMoney(auction.depositAmount) : tc("none")}
        />
        <Info label={t("detail.region")} value={auction.region ? regionLabel(auction.region) : tc("notSet")} />
        <Info label={t("detail.opens")} value={formatDateTime(auction.opensAt)} />
        <Info
          label={t("detail.closes")}
          value={`${formatDateTime(auction.closesAt)}${auction.extensionCount ? ` ${t("detail.extended", { count: auction.extensionCount })}` : ""}`}
        />
        {auction.winningAmount ? <Info label={t("detail.winningAmount")} value={formatMoney(auction.winningAmount)} /> : null}
        {auction.cancellationReason ? <Info label={t("detail.cancelledBecause")} value={auction.cancellationReason} /> : null}
      </CardContent>
    </Card>
  );
}

function LifecycleActions({ auction }: { auction: Auction }) {
  const { session, roles } = useAuth();
  const action = useAuctionAction(auction.id);
  const [cancelling, setCancelling] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const t = useT("workspace");
  const tc = useT("common");

  const run = (operation: () => Promise<unknown>, message: string, after?: () => void) =>
    void operation()
      .then(() => {
        toast.success(message);
        after?.();
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error, tc("actionFailed"))));

  const manager = canManageAuctions(roles);
  const approver = canApproveAuctions(roles);
  const isCreator = auction.createdBy === session?.user.id;

  const buttons = [
    auction.status === "draft" && manager ? (
      <Button key="submit" loading={action.submit.isPending} onClick={() => run(() => action.submit.mutateAsync(), t("detail.submitted"))}>
        {t("detail.submit")}
      </Button>
    ) : null,
    auction.status === "pending_review" && approver && !isCreator ? (
      <Button key="approve" loading={action.approve.isPending} onClick={() => run(() => action.approve.mutateAsync(), t("detail.approved"))}>
        {t("detail.approve")}
      </Button>
    ) : null,
    auction.status === "pending_review" && isCreator ? (
      <p key="two-person" className="self-center text-sm text-muted-foreground">
        {t("detail.twoPerson")}
      </p>
    ) : null,
    AWARDABLE.has(auction.status) && approver ? (
      <Button key="award" onClick={() => setAwarding(true)}>
        {t("detail.award")}
      </Button>
    ) : null,
    CANCELLABLE.has(auction.status) && manager ? (
      <Button key="cancel" variant="destructive-outline" onClick={() => setCancelling(true)}>
        {t("detail.cancel")}
      </Button>
    ) : null,
  ].filter(Boolean);

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="eyebrow text-primary">{t("detail.nextStep")}</p>
      <div className="flex flex-wrap gap-2">{buttons}</div>
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("detail.cancel")}
        description={t("detail.cancelDescription")}
        confirmLabel={t("detail.cancel")}
        destructive
        pending={action.cancel.isPending}
        onConfirm={(reason) => run(() => action.cancel.mutateAsync({ reason }), t("detail.cancelled"), () => setCancelling(false))}
      />
      <ConfirmDialog
        open={awarding}
        onOpenChange={setAwarding}
        title={t("detail.award")}
        description={t("detail.awardDescription")}
        confirmLabel={t("detail.awardConfirm")}
        pending={action.transition.isPending}
        onConfirm={() =>
          run(() => action.transition.mutateAsync({ status: "awarded" }), t("detail.awarded"), () => setAwarding(false))
        }
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums first-letter:uppercase">{value}</p>
    </div>
  );
}
