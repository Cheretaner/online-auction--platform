import { useState } from "react";
import type { NotificationChannel } from "@auction/shared";
import type { Auction } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/feedback/query-state";
import { Label } from "@/components/ui/label";
import { useRemoveWatchlist, useSaveWatchlist, useWatchlists } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import { useT } from "@/i18n/context";

type WatchlistChannel = Exclude<NotificationChannel, "voice">;

const CHANNELS: Array<{ value: WatchlistChannel; key: "inApp" | "email" | "telegram" }> = [
  { value: "in_app", key: "inApp" },
  { value: "email", key: "email" },
  { value: "telegram", key: "telegram" },
];

function WatchlistEditor({ auction }: { auction: Auction }) {
  const t = useT("auctions");
  const watchlists = useWatchlists();
  const save = useSaveWatchlist();
  const remove = useRemoveWatchlist();
  const records = watchlists.data?.items ?? [];
  const current = records.filter((record) => record.auctionId === auction.id);
  const [channelSelection, setChannelSelection] = useState<WatchlistChannel[] | null>(null);
  const [bidAlertSelection, setBidAlertSelection] = useState<boolean | null>(null);
  const [statusAlertSelection, setStatusAlertSelection] = useState<boolean | null>(null);
  const channels = channelSelection ?? (current.length ? current.map((record) => record.channel) : ["in_app"]);
  const alertOnBids = bidAlertSelection ?? (current.length ? current.some((record) => record.alertOnBids) : true);
  const alertOnStatus = statusAlertSelection ?? (current.length ? current.some((record) => record.alertOnStatus) : true);

  const toggleChannel = (channel: WatchlistChannel, checked: boolean) => {
    setChannelSelection((selected) => {
      const currentSelection = selected ?? channels;
      return checked
        ? [...new Set([...currentSelection, channel])]
        : currentSelection.filter((value) => value !== channel);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.watchlist.title")}</CardTitle>
        <CardDescription>{t("detail.watchlist.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {watchlists.isError ? <ErrorState error={watchlists.error} onRetry={() => void watchlists.refetch()} /> : null}
        {watchlists.isLoading ? <p role="status" className="text-sm text-muted-foreground">{t("detail.watchlist.loading")}</p> : null}
        {watchlists.isError ? null : (
          <>
            <fieldset disabled={watchlists.isLoading || save.isPending || remove.isPending} className="space-y-2 disabled:opacity-60">
              <legend className="mb-2 text-sm font-medium">{t("detail.watchlist.channels")}</legend>
              {CHANNELS.map(({ value, key }) => (
                <div key={value} className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id={`watchlist-${auction.id}-${value}`}
                    checked={channels.includes(value)}
                    onCheckedChange={(checked) => toggleChannel(value, checked === true)}
                  />
                  <Label htmlFor={`watchlist-${auction.id}-${value}`} className="cursor-pointer font-normal">
                    {t(`detail.watchlist.${key}`)}
                    {value === "telegram" ? <span className="ml-1 text-xs text-muted-foreground">({t("detail.watchlist.telegramHint")})</span> : null}
                  </Label>
                </div>
              ))}
            </fieldset>
            <fieldset disabled={watchlists.isLoading || save.isPending || remove.isPending} className="space-y-2 disabled:opacity-60">
              <legend className="mb-2 text-sm font-medium">{t("detail.watchlist.alertTypes")}</legend>
              <div className="flex min-h-8 items-center gap-2">
                <Checkbox id={`watchlist-bids-${auction.id}`} checked={alertOnBids} onCheckedChange={(checked) => setBidAlertSelection(checked === true)} />
                <Label htmlFor={`watchlist-bids-${auction.id}`} className="cursor-pointer font-normal">{t("detail.watchlist.bids")}</Label>
              </div>
              <div className="flex min-h-8 items-center gap-2">
                <Checkbox id={`watchlist-status-${auction.id}`} checked={alertOnStatus} onCheckedChange={(checked) => setStatusAlertSelection(checked === true)} />
                <Label htmlFor={`watchlist-status-${auction.id}`} className="cursor-pointer font-normal">{t("detail.watchlist.status")}</Label>
              </div>
              <p className="text-xs text-muted-foreground">{t("detail.watchlist.frequency")}</p>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={watchlists.isLoading || remove.isPending || channels.length === 0 || (!alertOnBids && !alertOnStatus)}
                loading={save.isPending}
                onClick={() => save.mutate({ auctionId: auction.id, body: { channels, alertOnBids, alertOnStatus } }, {
                  onSuccess: () => toast.success(t("detail.watchlist.saved")),
                  onError: (error) => toast.error(getErrorMessage(error)),
                })}
              >{current.length ? t("detail.watchlist.update") : t("detail.watchlist.follow")}</Button>
              {current.length ? (
                <Button variant="outline" disabled={save.isPending} loading={remove.isPending} onClick={() => remove.mutate(auction.id, {
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

export function WatchlistControls({ auction }: { auction: Auction }) {
  return <WatchlistEditor key={auction.id} auction={auction} />;
}
