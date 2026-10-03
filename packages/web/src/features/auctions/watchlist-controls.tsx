import { useEffect, useState } from "react";
import type { NotificationChannel } from "@auction/shared";
import type { Auction } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/query-state";
import { useRemoveWatchlist, useSaveWatchlist, useWatchlists } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import { useT } from "@/i18n/context";

const CHANNELS: Array<{ value: NotificationChannel; key: "inApp" | "email" | "telegram" }> = [
  { value: "in_app", key: "inApp" },
  { value: "email", key: "email" },
  { value: "telegram", key: "telegram" },
];

export function WatchlistControls({ auction }: { auction: Auction }) {
  const t = useT("auctions");
  const watchlists = useWatchlists();
  const save = useSaveWatchlist();
  const remove = useRemoveWatchlist();
  const records = watchlists.data?.items ?? [];
  const current = records.filter((record) => record.auctionId === auction.id);
  const [channels, setChannels] = useState<NotificationChannel[]>(["in_app"]);
  const [alertOnBids, setAlertOnBids] = useState(true);
  const [alertOnStatus, setAlertOnStatus] = useState(true);

  useEffect(() => {
    if (watchlists.isLoading) return;
    setChannels(current.length ? current.map((record) => record.channel) : ["in_app"]);
    setAlertOnBids(current.some((record) => record.alertOnBids));
    setAlertOnStatus(current.some((record) => record.alertOnStatus));
  }, [auction.id, watchlists.data, watchlists.isLoading]);

  const toggleChannel = (channel: NotificationChannel, checked: boolean) => {
    setChannels((selected) => checked
      ? [...new Set([...selected, channel])]
      : selected.filter((value) => value !== channel));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.watchlist.title")}</CardTitle>
        <CardDescription>{t("detail.watchlist.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {watchlists.isError ? <ErrorState error={watchlists.error} onRetry={() => void watchlists.refetch()} /> : null}
        {watchlists.isError ? null : (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("detail.watchlist.channels")}</legend>
              {CHANNELS.map(({ value, key }) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={channels.includes(value)} onChange={(event) => toggleChannel(value, event.target.checked)} />
                  {t(`detail.watchlist.${key}`)}
                  {value === "telegram" ? <span className="text-xs text-muted-foreground">({t("detail.watchlist.telegramHint")})</span> : null}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("detail.watchlist.alertTypes")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alertOnBids} onChange={(event) => setAlertOnBids(event.target.checked)} />
                {t("detail.watchlist.bids")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alertOnStatus} onChange={(event) => setAlertOnStatus(event.target.checked)} />
                {t("detail.watchlist.status")}
              </label>
              <p className="text-xs text-muted-foreground">{t("detail.watchlist.frequency")}</p>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={watchlists.isLoading || channels.length === 0 || (!alertOnBids && !alertOnStatus)}
                loading={save.isPending}
                onClick={() => save.mutate({ auctionId: auction.id, body: { channels, alertOnBids, alertOnStatus } }, {
                  onSuccess: () => toast.success(t("detail.watchlist.saved")),
                  onError: (error) => toast.error(getErrorMessage(error)),
                })}
              >{current.length ? t("detail.watchlist.update") : t("detail.watchlist.follow")}</Button>
              {current.length ? (
                <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(auction.id, {
                  onSuccess: () => toast.success(t("detail.watchlist.removed")),
                  onError: (error) => toast.error(getErrorMessage(error)),
                })}>{t("detail.watchlist.unfollow")}</Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
