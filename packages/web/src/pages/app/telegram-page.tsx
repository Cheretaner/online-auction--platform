import { useState } from "react";
import { Megaphone, Unlink } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgAuctions } from "@/features/auctions/queries";
import { useAuth } from "@/features/auth/auth-provider";
import {
  useTelegramBroadcast,
  useTelegramLinkToken,
  useTelegramStatus,
  useTelegramUnlink,
} from "@/features/telegram/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { TelegramLinkToken, TelegramStatus } from "@/lib/api/types";
import { canManageAuctions, formatDateTime } from "@/lib/format";

/** While a link code is on screen, poll so the page flips to “linked” on its own. */
const POLL_INTERVAL_MS = 5000;
const NO_AUCTION = "none";

export default function TelegramPage() {
  const { roles } = useAuth();
  const [link, setLink] = useState<TelegramLinkToken | null>(null);
  const status = useTelegramStatus(true, link ? POLL_INTERVAL_MS : false);
  const createToken = useTelegramLinkToken();
  const unlink = useTelegramUnlink();
  const linked = Boolean(status.data?.telegramLinkedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram channel"
        description="Link your Telegram account to receive auction alerts, and let the platform post your auctions on the public channel."
      />
      {status.isLoading ? (
        <PageSkeleton rows={2} />
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <AccountLink
          linked={linked}
          status={status.data}
          link={link}
          onLink={() =>
            createToken.mutate(undefined, {
              onSuccess: (token) => setLink(token),
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
          linking={createToken.isPending}
          onUnlink={() =>
            unlink.mutate(undefined, {
              onSuccess: () => {
                setLink(null);
                toast.success("Telegram account unlinked");
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
          unlinking={unlink.isPending}
        />
      )}
      <ChannelPosting canPost={canManageAuctions(roles)} />
    </div>
  );
}

function AccountLink({
  linked,
  status,
  link,
  onLink,
  linking,
  onUnlink,
  unlinking,
}: {
  linked: boolean;
  status: TelegramStatus | undefined;
  link: TelegramLinkToken | null;
  onLink: () => void;
  linking: boolean;
  onUnlink: () => void;
  unlinking: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account link</CardTitle>
        <CardDescription>
          The bot gives you a one-time code that is valid for fifteen minutes; open the deep link and send it
          to the bot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Badge variant="success">
                Linked as {status?.telegramUsername ? `@${status.telegramUsername}` : "Telegram account"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Linked{" "}
                {status?.telegramLinkedAt ? formatDateTime(status.telegramLinkedAt) : "recently"}
                {status?.telegramId ? ` · id ${status.telegramId}` : ""}
              </p>
            </div>
            <Button type="button" variant="destructive-outline" loading={unlinking} onClick={onUnlink}>
              {unlinking ? null : <Unlink aria-hidden />}
              {unlinking ? "Unlinking…" : "Unlink"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" loading={linking} onClick={onLink}>
              {linking ? "Preparing code…" : "Link Telegram account"}
            </Button>
            {link ? (
              <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      One-time code — expires {formatDateTime(link.expiresAt)}
                    </p>
                    <p className="mt-1 font-mono text-xl font-semibold tracking-[0.2em]">{link.token}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(link.token)
                        .then(() => toast.success("Code copied"))
                        .catch(() => toast.error("Copy failed — select the code manually"))
                    }
                  >
                    Copy code
                  </Button>
                </div>
                {link.deepLink ? (
                  <Button asChild type="button" size="sm">
                    <a href={link.deepLink} target="_blank" rel="noreferrer">
                      Open in Telegram
                    </a>
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  This page refreshes every few seconds while the code is shown and updates itself once the
                  bot confirms the link.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/**
 * Posting is entirely a server-side action against the organization's configured
 * channel: the UI can only ask for it, and posting an auction that was already
 * published edits the existing channel post rather than duplicating it.
 */
function ChannelPosting({ canPost }: { canPost: boolean }) {
  const { session } = useAuth();
  const orgId = session?.organizationId ?? undefined;
  const auctions = useOrgAuctions(orgId);
  const options = auctions.data?.items ?? [];
  const broadcast = useTelegramBroadcast();
  const [auctionId, setAuctionId] = useState<string>(NO_AUCTION);
  const selected = auctionId === NO_AUCTION ? undefined : auctionId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground" aria-hidden /> Public channel
        </CardTitle>
        <CardDescription>
          Publish an auction card to the platform&apos;s configured public channel. Running it again edits the
          existing post instead of spamming a second one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canPost ? (
          <p className="text-sm text-muted-foreground">Auction manager access is required to publish.</p>
        ) : (
          <>
            <div className="w-full space-y-1.5 sm:max-w-sm">
              <Label htmlFor="tg-auction">Auction</Label>
              <Select value={auctionId} onValueChange={setAuctionId}>
                <SelectTrigger id="tg-auction">
                  <SelectValue placeholder="Choose an auction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AUCTION}>Choose an auction</SelectItem>
                  {options.map((auction) => (
                    <SelectItem key={auction.id} value={auction.id}>
                      {auction.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={!selected}
                loading={broadcast.isPending}
                onClick={() =>
                  selected &&
                  broadcast.mutate(selected, {
                    onSuccess: (result) =>
                      result.broadcasted
                        ? toast.success("Auction published to the channel")
                        : toast.warning("The organization has no Telegram channel configured yet"),
                    onError: (error) => toast.error(getErrorMessage(error)),
                  })
                }
              >
                {broadcast.isPending ? "Publishing…" : "Publish to channel"}
              </Button>
              {options.length === 0 ? (
                <p className="text-xs text-muted-foreground">No auctions in your organization yet.</p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Channel setup is managed by the platform operator. Telegram requires the configured bot to be
              an administrator with permission to post messages.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

