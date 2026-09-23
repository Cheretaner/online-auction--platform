import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useAuction,
  useAuctionAction,
  useAuctionItems,
} from "@/features/auctions/queries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-provider";

export default function WorkspaceAuctionDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const auction = useAuction(id);
  const items = useAuctionItems(id);
  const action = useAuctionAction(id ?? "");
  const record = auction.data;
  const run = (operation: () => Promise<unknown>, message: string) =>
    void operation()
      .then(() => toast.success(message))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Action failed"),
      );
  return (
    <div>
      <PageHeader
        title={record?.title ?? "Auction details"}
        description="Organization workspace view"
        actions={
          record?.status === "draft" ? (
            <Button asChild variant="outline">
              <Link to={`/app/auctions/${id}/edit`}>Edit auction</Link>
            </Button>
          ) : null
        }
      />
      <QueryState
        isLoading={auction.isLoading}
        isError={auction.isError}
        error={auction.error}
        onRetry={() => void auction.refetch()}
      >
        {record ? (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">Overview</CardTitle>
                  <StatusBadge status={record.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Info
                  label="Auction type"
                  value={record.auctionType.replaceAll("_", " ")}
                />
                <Info
                  label="Starting price"
                  value={formatMoney(record.startPrice)}
                />
                <Info
                  label="Current highest bid"
                  value={
                    record.currentHighestBid
                      ? formatMoney(record.currentHighestBid)
                      : "No bids"
                  }
                />
                <Info label="Bid count" value={String(record.bidCount)} />
                <Info label="Opens" value={formatDateTime(record.opensAt)} />
                <Info label="Closes" value={formatDateTime(record.closesAt)} />
                <Info
                  label="Deposit"
                  value={formatMoney(record.depositAmount)}
                />
                <Info label="Region" value={record.region ?? "Not set"} />
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-2">
              {record.status === "draft" ? (
                <Button
                  disabled={action.submit.isPending}
                  onClick={() =>
                    run(
                      () => action.submit.mutateAsync(),
                      "Auction submitted for review",
                    )
                  }
                >
                  Submit for review
                </Button>
              ) : null}
              {record.status === "pending_review" &&
              record.createdBy !== session?.user.id ? (
                <Button
                  disabled={action.approve.isPending}
                  onClick={() =>
                    run(() => action.approve.mutateAsync(), "Auction approved")
                  }
                >
                  Approve auction
                </Button>
              ) : null}
              {record.status === "closed" &&
              record.auctionType === "sealed_bid" &&
              !record.sealedOpenedAt ? (
                <Button
                  variant="outline"
                  disabled={action.openSealed.isPending}
                  onClick={() =>
                    run(
                      () => action.openSealed.mutateAsync(),
                      "Sealed bids opened",
                    )
                  }
                >
                  Open sealed bids
                </Button>
              ) : null}
            </div>
            <section>
              <h2 className="mb-3 text-lg font-semibold">Lots</h2>
              <QueryState
                isLoading={items.isLoading}
                isError={items.isError}
                error={items.error}
                isEmpty={(items.data?.items.length ?? 0) === 0}
                emptyTitle="No lots added"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.data?.items.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.description || "No description"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Quantity: {item.quantity} {item.unit ?? ""}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </QueryState>
            </section>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
  );
}
