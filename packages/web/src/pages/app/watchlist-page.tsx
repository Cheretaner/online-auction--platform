import { useMemo } from "react";
import { ArrowUpRight, Bell, Bookmark, Gavel, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRemoveWatchlist, useWatchlists } from "@/features/operations/queries";
import type { WatchlistRecord } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime, statusLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

function groupWatchlists(records: WatchlistRecord[]) {
  const groups = new Map<string, { record: WatchlistRecord; channels: WatchlistRecord[] }>();
  for (const record of records) {
    const group = groups.get(record.auctionId);
    if (group) group.channels.push(record);
    else groups.set(record.auctionId, { record, channels: [record] });
  }
  return [...groups.values()];
}

export default function WatchlistPage() {
  const query = useWatchlists();
  const remove = useRemoveWatchlist();
  const t = useT("auctions");
  const tc = useT("common");
  const records = query.data?.items;
  const auctions = useMemo(() => groupWatchlists(records ?? []), [records]);

  return (
    <div>
      <PageHeader title={t("watchlistPage.title")} description={t("watchlistPage.description")} />
      {query.isLoading ? (
        <PageSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : auctions.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={t("watchlistPage.emptyTitle")}
          description={t("watchlistPage.emptyDescription")}
          action={
            <Button asChild>
              <Link to="/auctions">{tc("viewAuction")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2" aria-label={t("watchlistPage.title")}>
          {auctions.map(({ record, channels }) => {
            const alertOnBids = channels.some((item) => item.alertOnBids);
            const alertOnStatus = channels.some((item) => item.alertOnStatus);
            return (
              <li key={record.auctionId}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Gavel aria-hidden className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 font-semibold leading-snug">{record.auctionTitle}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{statusLabel(record.auctionStatus)}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <Bell aria-hidden /> {channels.length === 1
                          ? t("watchlistPage.channelCountOne")
                          : t("watchlistPage.channelCountOther", { count: channels.length })}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {channels.map((item) => (
                        <Badge key={item.channel} variant="outline">
                          {t(`detail.watchlist.${item.channel === "in_app" ? "inApp" : item.channel}`)}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {alertOnBids ? <span>{t("detail.watchlist.bids")}</span> : null}
                      {alertOnStatus ? <span>{t("detail.watchlist.status")}</span> : null}
                      <span className="ml-auto">{formatDateTime(record.createdAt)}</span>
                    </div>
                    <div className="mt-auto flex justify-end gap-2 border-t pt-3">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/auctions/${record.auctionId}`}>
                          {t("watchlistPage.manage")} <ArrowUpRight aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        disabled={remove.isPending}
                        loading={remove.isPending && remove.variables === record.auctionId}
                        onClick={() => remove.mutate(record.auctionId, {
                          onSuccess: () => toast.success(t("detail.watchlist.removed")),
                          onError: (error) => toast.error(getErrorMessage(error)),
                        })}
                      >
                        <Trash2 aria-hidden /> {t("detail.watchlist.unfollow")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
