import { useState } from "react";
import { Bot, CircleAlert, CircleCheck, Megaphone, RefreshCw, Unlink } from "lucide-react";
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
  useTelegramIntegrationStatus,
  useTelegramStatus,
  useTelegramUnlink,
} from "@/features/telegram/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { TelegramIntegrationStatus, TelegramLinkToken, TelegramStatus } from "@/lib/api/types";
import { canManageAuctions, formatDateTime } from "@/lib/format";

/** While a link code is on screen, poll so the page flips to “linked” on its own. */
const NO_AUCTION = "none";

export default function TelegramPage() {
  const { roles } = useAuth();
  const [link, setLink] = useState<TelegramLinkToken | null>(null);
  const status = useTelegramStatus(true, link?.expiresAt);
  const createToken = useTelegramLinkToken();
  const unlink = useTelegramUnlink();
  const canPost = canManageAuctions(roles);
  const integration = useTelegramIntegrationStatus(canPost);
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
      <IntegrationStatus status={integration.data} loading={integration.isLoading} error={integration.error} onRefresh={() => void integration.refetch()} canView={canPost} />
      <ChannelPosting canPost={canPost} />
    </div>
  );
}

function IntegrationStatus({
  status,
  loading,
  error,
  onRefresh,
  canView,
}: {
  status: TelegramIntegrationStatus | undefined;
  loading: boolean;
  error: Error | null;
  onRefresh: () => void;
  canView: boolean;
}) {
  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bot and channel health</CardTitle>
          <CardDescription>Integration diagnostics are available to auction officers and organization administrators.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const botOkay = status?.bot.status === "connected" && ["webhook", "polling"].includes(status.bot.inboundTransport);
  const channelOkay = status?.channel.status === "connected";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Bot and channel health</CardTitle>
          <CardDescription>Live checks from Telegram. Refresh after changing the platform bot or channel settings.</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {getErrorMessage(error, "Could not load Telegram integration status.")}
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <IntegrationCard
            icon={<Bot className="size-5" aria-hidden />}
            title="Telegram bot"
            okay={Boolean(botOkay)}
            loading={loading}
            status={botLabel(status?.bot.status, status?.bot.inboundTransport)}
          >
            {status?.bot.username ? <p>Bot: <span className="font-medium">{status.bot.username}</span></p> : null}
            <p>Updates: <span className="font-medium">{transportLabel(status?.bot.inboundTransport)}</span></p>
            {!status?.bot.configured ? <p>Set <code>TELEGRAM_BOT_TOKEN</code> in the API environment.</p> : null}
            {status?.bot.inboundTransport === "disabled" ? <p>Enable webhook delivery or set <code>TELEGRAM_POLLING=true</code>.</p> : null}
            {status?.bot.inboundTransport === "error" || status?.bot.status === "error" ? (
              <p className="break-words text-destructive">{status.bot.inboundError || "Telegram could not start the bot update transport."}</p>
            ) : null}
          </IntegrationCard>

          <IntegrationCard
            icon={<Megaphone className="size-5" aria-hidden />}
            title="Public channel"
            okay={Boolean(channelOkay)}
            loading={loading}
            status={channelLabel(status?.channel.status)}
          >
            {status?.channel.title ? <p>Channel: <span className="font-medium">{status.channel.username ? `@${status.channel.username}` : status.channel.title}</span></p> : null}
            {!status?.channel.configured ? <p>Set <code>TELEGRAM_CHANNEL_ID</code> in the API environment.</p> : null}
            {status?.channel.status === "permission_required" ? <p>Add the bot as a channel administrator with permission to post messages.</p> : null}
            {status?.channel.status === "bot_not_configured" ? <p>Configure the bot before checking its channel access.</p> : null}
            {status?.channel.status === "error" ? <p className="break-words text-destructive">{status.channel.error || "Telegram could not check access to this channel."}</p> : null}
            {status?.channel.status === "connected" ? <p>The bot can publish and update auction announcements.</p> : null}
          </IntegrationCard>
        </div>
        {status?.bot.inboundTransport === "starting" ? <p className="mt-3 text-xs text-muted-foreground">The bot update transport is starting; refresh in a few seconds.</p> : null}
      </CardContent>
    </Card>
  );
}

function IntegrationCard({
  icon,
  title,
  status,
  okay,
  loading,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  okay: boolean;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
        <Badge variant={loading ? "muted" : okay ? "success" : "outline"} className="gap-1">
          {loading ? null : okay ? <CircleCheck className="size-3" aria-hidden /> : <CircleAlert className="size-3" aria-hidden />}
          {loading ? "Checking" : status}
        </Badge>
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function transportLabel(transport: string | undefined): string {
  if (transport === "webhook") return "Webhook active";
  if (transport === "polling") return "Long polling active";
  if (transport === "starting") return "Starting";
  if (transport === "error") return "Failed";
  return "Disabled";
}

function botLabel(status: string | undefined, transport: string | undefined): string {
  if (status === "not_configured") return "Not configured";
  if (status === "error") return "Connection failed";
  if (transport === "error") return "Updates transport failed";
  if (transport === "starting") return "Starting";
  if (transport === "disabled") return "Updates disabled";
  return "Bot connected";
}

function channelLabel(status: string | undefined): string {
  if (status === "connected") return "Ready to post";
  if (status === "permission_required") return "Needs admin permission";
  if (status === "bot_not_configured") return "Bot not configured";
  if (status === "error") return "Channel check failed";
  return "Not configured";
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
        <CardTitle className="text-base">Account link</CardTitle>
        <CardDescription>
          The bot gives you a one-time code that is valid for fifteen minutes; open the deep link and send it
          to the bot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Badge variant="outline">
                Linked as {status?.telegramUsername ? `@${status.telegramUsername}` : "Telegram account"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Linked{" "}
                {status?.telegramLinkedAt ? formatDateTime(status.telegramLinkedAt) : "recently"}
                {status?.telegramId ? ` · id ${status.telegramId}` : ""}
              </p>
            </div>
            <Button type="button" variant="outline" disabled={unlinking} onClick={onUnlink}>
              <Unlink className="size-4" aria-hidden />
              {unlinking ? "Unlinking…" : "Unlink"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" disabled={linking} onClick={onLink}>
              {linking ? "Preparing code…" : "Link Telegram account"}
            </Button>
            {link ? (
              <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      One-time code — expires {formatDateTime(link.expiresAt)}
                    </p>
                    <p className="font-mono text-lg tracking-widest">{link.token}</p>
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
  const options = (auctions.data?.items ?? []).filter((auction) =>
    ["scheduled", "live", "closed", "under_review", "awarded", "cancelled"].includes(auction.status),
  );
  const broadcast = useTelegramBroadcast();
  const [auctionId, setAuctionId] = useState<string>(NO_AUCTION);
  const selected = auctionId === NO_AUCTION ? undefined : auctionId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4" aria-hidden /> Public channel
        </CardTitle>
        <CardDescription>
          Approved auctions are posted automatically. The bot updates that post when bidding opens and as auction activity changes. You can also publish an eligible auction here.
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
                disabled={!selected || broadcast.isPending}
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
                <p className="text-xs text-muted-foreground">No approved auctions are available to publish.</p>
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

