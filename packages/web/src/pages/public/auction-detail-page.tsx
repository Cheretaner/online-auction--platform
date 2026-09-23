import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PlaceBidRequest } from "@auction/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { useAuction, useAuctionBids, useAuctionItems, usePlaceBid } from "@/features/auctions/queries";
import { formatDateTime, formatMoney, hasRole } from "@/lib/format";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { getErrorMessage } from "@/lib/api/errors";
import { subscribeToEvents } from "@/lib/realtime/sse";
import { queryKeys } from "@/lib/query/keys";
import { useQueryClient } from "@tanstack/react-query";

export default function AuctionDetailPage() {
  const { id } = useParams();
  const auction = useAuction(id);
  const items = useAuctionItems(id);
  const { isAuthenticated, session } = useAuth();
  const bids = useAuctionBids(id, isAuthenticated);
  const placeBid = usePlaceBid(id ?? "");
  const queryClient = useQueryClient();
  const [commitment, setCommitment] = useState("");

  const form = useForm({
    resolver: zodResolver(PlaceBidRequest),
    defaultValues: { amount: "" },
  });

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    return subscribeToEvents(`auction:${id}`, () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(id) });
    });
  }, [id, isAuthenticated, queryClient]);

  const canBid = isAuthenticated && hasRole(session?.roles ?? [], "bidder") && auction.data?.status === "live";

  return (
    <QueryState
      isLoading={auction.isLoading}
      isError={auction.isError}
      error={auction.error}
      onRetry={() => auction.refetch()}
    >
      {auction.data ? (
        <div className="space-y-6">
          <PageHeader
            title={auction.data.title}
            description={auction.data.description ?? undefined}
            actions={<StatusBadge status={auction.data.status} />}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Start price" value={formatMoney(auction.data.startPrice)} />
            <Metric label="Highest bid" value={formatMoney(auction.data.currentHighestBid)} />
            <Metric label="Bids" value={String(auction.data.bidCount)} />
            <Metric label="Closes" value={formatDateTime(auction.data.closesAt)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Lots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(items.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No lots published yet.</p>
              ) : (
                items.data?.items.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {canBid ? (
            <Card>
              <CardHeader>
                <CardTitle>Place a bid</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={form.handleSubmit(async (values) => {
                      try {
                        await placeBid.mutateAsync({
                          amount: values.amount,
                          commitmentHash: commitment || undefined,
                        });
                        toast.success("Bid placed");
                        form.reset();
                        setCommitment("");
                      } catch (error) {
                        if (!applyApiFieldErrors(error, form.setError)) {
                          toast.error(getErrorMessage(error));
                        }
                      }
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input inputMode="decimal" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {auction.data.auctionType === "sealed_bid" ? (
                      <FormItem>
                        <FormLabel>Commitment hash (optional)</FormLabel>
                        <Input
                          value={commitment}
                          onChange={(event) => setCommitment(event.target.value)}
                          placeholder="64-character sha256 hex"
                        />
                      </FormItem>
                    ) : null}
                    <div className="sm:col-span-2">
                      <Button type="submit" disabled={placeBid.isPending}>
                        {placeBid.isPending ? "Submitting…" : "Submit bid"}
                      </Button>
                    </div>
                  </form>
                </Form>
                <p className="mt-3 text-xs text-muted-foreground">
                  Bids send an <code>Idempotency-Key</code> automatically. KYC and a verified deposit may be required.
                </p>
              </CardContent>
            </Card>
          ) : !isAuthenticated ? (
            <p className="text-sm">
              <Link className="text-primary underline" to="/login">
                Sign in
              </Link>{" "}
              as a bidder to participate.
            </p>
          ) : null}
          {isAuthenticated ? (
            <Card>
              <CardHeader>
                <CardTitle>Bid activity</CardTitle>
              </CardHeader>
              <CardContent>
                {(bids.data?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bids visible yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {bids.data?.items.map((bid) => (
                      <li key={bid.id} className="flex justify-between gap-4 border-b py-2">
                        <span>{bid.isSealed ? "Sealed commitment" : formatMoney(bid.amount)}</span>
                        <span className="text-muted-foreground">{formatDateTime(bid.placedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </QueryState>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
