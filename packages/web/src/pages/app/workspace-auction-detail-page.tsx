import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { QueryState } from "@/components/feedback/query-state";
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
import { useAiAnomalies, useDisputes } from "@/features/operations/queries";
import { CompliancePanel } from "@/features/workspace/compliance-panel";
import { DepositReview } from "@/features/workspace/deposit-review";
import { LotsManager } from "@/features/workspace/lots-manager";
import { ReportsPanel } from "@/features/workspace/reports-panel";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { canApproveAuctions, canManageAuctions, formatDateTime, formatMoney, hasRole } from "@/lib/format";

const CANCELLABLE = new Set(["draft", "pending_review", "scheduled", "live"]);
const AWARDABLE = new Set(["closed", "under_review"]);

export default function WorkspaceAuctionDetailPage() {
  const { id } = useParams();
  const auction = useAuction(id);
  const record = auction.data;
  return (
    <div>
      <PageHeader
        title={record?.title ?? "Auction details"}
        description="Organization workspace"
        actions={
          record ? (
            <div className="flex flex-wrap gap-2">
              {record.status === "draft" ? (
                <Button asChild variant="outline">
                  <Link to={`/app/auctions/${record.id}/edit`}>Edit auction</Link>
                </Button>
              ) : null}
              {record.status !== "draft" && record.status !== "pending_review" ? (
                <Button asChild variant="ghost">
                  <Link to={`/auctions/${record.id}`}>Public page</Link>
                </Button>
              ) : null}
            </div>
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

  return (
    <div className="space-y-5">
      <Overview auction={auction} />
      <LifecycleActions auction={auction} />
      <Tabs defaultValue="lots">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="lots">Lots</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies{openFlags ? ` (${openFlags})` : ""}</TabsTrigger>
            <TabsTrigger value="disputes">Disputes{openDisputes ? ` (${openDisputes})` : ""}</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="lots" className="pt-4">
          <LotsManager auctionId={auction.id} editable={auction.status === "draft" && canManageAuctions(roles)} />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <AuctionDocuments auctionId={auction.id} canUpload />
        </TabsContent>
        <TabsContent value="deposits" className="pt-4">
          {Number(auction.depositAmount) > 0 ? (
            <DepositReview auction={auction} />
          ) : (
            <p className="text-sm text-muted-foreground">This auction does not require bid security.</p>
          )}
        </TabsContent>
        <TabsContent value="compliance" className="pt-4">
          <CompliancePanel auctionId={auction.id} canRun={reviewer} />
        </TabsContent>
        <TabsContent value="anomalies" className="pt-4">
          {(anomalies.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No anomaly flags on this auction.</p>
          ) : (
            <AnomalyList items={anomalies.data?.items ?? []} showAuctionLink={false} />
          )}
        </TabsContent>
        <TabsContent value="disputes" className="pt-4">
          {(disputes.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No disputes on this auction.</p>
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
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Overview</CardTitle>
          <StatusBadge status={auction.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Auction type" value={auction.auctionType.replaceAll("_", " ")} />
        <Info label="Starting price" value={formatMoney(auction.startPrice)} />
        <Info label="Minimum increment" value={formatMoney(auction.minIncrement)} />
        <Info label="Reserve" value={auction.reservePrice ? formatMoney(auction.reservePrice) : "None"} />
        <Info
          label="Highest bid"
          value={Number(auction.currentHighestBid ?? 0) > 0 ? formatMoney(auction.currentHighestBid) : "No bids yet"}
        />
        <Info label="Bids" value={String(auction.bidCount)} />
        <Info label="Deposit" value={Number(auction.depositAmount) > 0 ? formatMoney(auction.depositAmount) : "None"} />
        <Info label="Region" value={auction.region ?? "Not set"} />
        <Info label="Opens" value={formatDateTime(auction.opensAt)} />
        <Info
          label="Closes"
          value={`${formatDateTime(auction.closesAt)}${auction.extensionCount ? ` (extended ${auction.extensionCount}×)` : ""}`}
        />
        {auction.winningAmount ? <Info label="Winning amount" value={formatMoney(auction.winningAmount)} /> : null}
        {auction.cancellationReason ? <Info label="Cancelled because" value={auction.cancellationReason} /> : null}
      </CardContent>
    </Card>
  );
}

function LifecycleActions({ auction }: { auction: Auction }) {
  const { session, roles } = useAuth();
  const action = useAuctionAction(auction.id);
  const [cancelling, setCancelling] = useState(false);
  const [awarding, setAwarding] = useState(false);

  const run = (operation: () => Promise<unknown>, message: string, after?: () => void) =>
    void operation()
      .then(() => {
        toast.success(message);
        after?.();
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error, "Action failed")));

  const manager = canManageAuctions(roles);
  const approver = canApproveAuctions(roles);
  const isCreator = auction.createdBy === session?.user.id;

  const buttons = [
    auction.status === "draft" && manager ? (
      <Button key="submit" disabled={action.submit.isPending} onClick={() => run(() => action.submit.mutateAsync(), "Submitted for review")}>
        Submit for review
      </Button>
    ) : null,
    auction.status === "pending_review" && approver && !isCreator ? (
      <Button key="approve" disabled={action.approve.isPending} onClick={() => run(() => action.approve.mutateAsync(), "Auction approved")}>
        Approve auction
      </Button>
    ) : null,
    auction.status === "pending_review" && isCreator ? (
      <p key="two-person" className="self-center text-sm text-muted-foreground">
        Another approver must approve this auction (two-person rule).
      </p>
    ) : null,
    auction.status === "closed" && auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt ? (
      <Button
        key="open-sealed"
        variant="outline"
        disabled={action.openSealed.isPending}
        onClick={() => run(() => action.openSealed.mutateAsync(), "Sealed bids opened")}
      >
        Open sealed bids
      </Button>
    ) : null,
    AWARDABLE.has(auction.status) && approver ? (
      <Button key="award" onClick={() => setAwarding(true)}>
        Award auction
      </Button>
    ) : null,
    CANCELLABLE.has(auction.status) && manager ? (
      <Button key="cancel" variant="destructive" onClick={() => setCancelling(true)}>
        Cancel auction
      </Button>
    ) : null,
  ].filter(Boolean);

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {buttons}
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel auction"
        description="Cancelling is final. Bidders are notified and the reason is published with the auction."
        confirmLabel="Cancel auction"
        destructive
        pending={action.cancel.isPending}
        onConfirm={(reason) => run(() => action.cancel.mutateAsync({ reason }), "Auction cancelled", () => setCancelling(false))}
      />
      <ConfirmDialog
        open={awarding}
        onOpenChange={setAwarding}
        title="Award auction"
        description="Awarding is final. It is refused while a high-severity anomaly flag is open or the audit chain is broken."
        confirmLabel="Award"
        pending={action.transition.isPending}
        onConfirm={() =>
          run(() => action.transition.mutateAsync({ status: "awarded" }), "Auction awarded", () => setAwarding(false))
        }
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
  );
}
