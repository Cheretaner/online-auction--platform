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
import { translate, useT } from "@/i18n/context";

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
  const t = useT("tools");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("telegram.title")}
        description={t("telegram.description")}
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
                toast.success(t("telegram.unlinked"));
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
  const t = useT("tools");
  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("health.title")}</CardTitle>
          <CardDescription>{t("health.restricted")}</CardDescription>
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
          <CardTitle>{t("health.title")}</CardTitle>
          <CardDescription>{t("health.description")}</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          {t("health.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {getErrorMessage(error, t("health.loadError"))}
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <IntegrationCard
            icon={<Bot className="size-5" aria-hidden />}
            title={t("health.bot")}
            okay={Boolean(botOkay)}
            loading={loading}
            status={botLabel(status?.bot.status, status?.bot.inboundTransport)}
          >
            {status?.bot.username ? <p>{t("health.botName")} <span className="font-medium">{status.bot.username}</span></p> : null}
            <p>{t("health.updates")} <span className="font-medium">{transportLabel(status?.bot.inboundTransport)}</span></p>
            {!status?.bot.configured ? <p>{t("health.setEnvBefore")}<code>TELEGRAM_BOT_TOKEN</code>{t("health.setEnvAfter")}</p> : null}
            {status?.bot.inboundTransport === "disabled" ? <p>{t("health.enableBefore")}<code>TELEGRAM_POLLING=true</code>{t("health.enableAfter")}</p> : null}
            {status?.bot.inboundTransport === "error" || status?.bot.status === "error" ? (
              <p className="break-words text-destructive">{status.bot.inboundError || t("health.botTransportError")}</p>
            ) : null}
          </IntegrationCard>

          <IntegrationCard
            icon={<Megaphone className="size-5" aria-hidden />}
            title={t("health.channel")}
            okay={Boolean(channelOkay)}
            loading={loading}
            status={channelLabel(status?.channel.status)}
          >
            {status?.channel.title ? <p>{t("health.channelName")} <span className="font-medium">{status.channel.username ? `@${status.channel.username}` : status.channel.title}</span></p> : null}
            {!status?.channel.configured ? <p>{t("health.setEnvBefore")}<code>TELEGRAM_CHANNEL_ID</code>{t("health.setEnvAfter")}</p> : null}
            {status?.channel.status === "permission_required" ? <p>{t("health.needsAdmin")}</p> : null}
            {status?.channel.status === "bot_not_configured" ? <p>{t("health.configureBotFirst")}</p> : null}
            {status?.channel.status === "error" ? <p className="break-words text-destructive">{status.channel.error || t("health.channelError")}</p> : null}
            {status?.channel.status === "connected" ? <p>{t("health.channelReady")}</p> : null}
          </IntegrationCard>
        </div>
        {status?.bot.inboundTransport === "starting" ? <p className="mt-3 text-xs text-muted-foreground">{t("health.starting")}</p> : null}
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
  const t = useT("tools");
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
        <Badge variant={loading ? "muted" : okay ? "success" : "outline"} className="gap-1">
          {loading ? null : okay ? <CircleCheck className="size-3" aria-hidden /> : <CircleAlert className="size-3" aria-hidden />}
          {loading ? t("health.checking") : status}
        </Badge>
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function transportLabel(transport: string | undefined): string {
  if (transport === "webhook") return translate("tools", "health.transport.webhook");
  if (transport === "polling") return translate("tools", "health.transport.polling");
  if (transport === "starting") return translate("tools", "health.transport.starting");
  if (transport === "error") return translate("tools", "health.transport.error");
  return translate("tools", "health.transport.disabled");
}

function botLabel(status: string | undefined, transport: string | undefined): string {
  if (status === "not_configured") return translate("tools", "health.botStatus.notConfigured");
  if (status === "error") return translate("tools", "health.botStatus.error");
  if (transport === "error") return translate("tools", "health.botStatus.transportError");
  if (transport === "starting") return translate("tools", "health.botStatus.starting");
  if (transport === "disabled") return translate("tools", "health.botStatus.disabled");
  return translate("tools", "health.botStatus.connected");
}

function channelLabel(status: string | undefined): string {
  if (status === "connected") return translate("tools", "health.channelStatus.connected");
  if (status === "permission_required") return translate("tools", "health.channelStatus.permission");
  if (status === "bot_not_configured") return translate("tools", "health.channelStatus.botMissing");
  if (status === "error") return translate("tools", "health.channelStatus.error");
  return translate("tools", "health.channelStatus.notConfigured");
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
  const t = useT("tools");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("telegram.accountLink")}</CardTitle>
        <CardDescription>{t("telegram.accountLinkDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Badge variant="success">
                {t("telegram.linkedAs", {
                  name: status?.telegramUsername ? `@${status.telegramUsername}` : t("telegram.telegramAccount"),
                })}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {t("telegram.linkedOn", {
                  date: status?.telegramLinkedAt ? formatDateTime(status.telegramLinkedAt) : t("telegram.recently"),
                })}
                {status?.telegramId ? ` · id ${status.telegramId}` : ""}
              </p>
            </div>
            <Button type="button" variant="destructive-outline" loading={unlinking} onClick={onUnlink}>
              {unlinking ? null : <Unlink aria-hidden />}
              {unlinking ? t("telegram.unlinking") : t("telegram.unlink")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" loading={linking} onClick={onLink}>
              {linking ? t("telegram.preparing") : t("telegram.link")}
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
                        .then(() => toast.success(t("telegram.codeCopied")))
                        .catch(() => toast.error(t("telegram.copyFailed")))
                    }
                  >
                    {t("telegram.copyCode")}
                  </Button>
                </div>
                {link.deepLink ? (
                  <Button asChild type="button" size="sm">
                    <a href={link.deepLink} target="_blank" rel="noreferrer">
                      {t("telegram.open")}
                    </a>
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {t("telegram.polling")}
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
  const t = useT("tools");
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
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground" aria-hidden /> {t("telegram.channel")}
        </CardTitle>
        <CardDescription>
          {t("telegram.channelDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canPost ? (
          <p className="text-sm text-muted-foreground">{t("telegram.needsManager")}</p>
        ) : (
          <>
            <div className="w-full space-y-1.5 sm:max-w-sm">
              <Label htmlFor="tg-auction">{t("telegram.auction")}</Label>
              <Select value={auctionId} onValueChange={setAuctionId}>
                <SelectTrigger id="tg-auction">
                  <SelectValue placeholder={t("telegram.chooseAuction")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AUCTION}>{t("telegram.chooseAuction")}</SelectItem>
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
                        ? toast.success(t("telegram.published"))
                        : toast.warning(t("telegram.noChannel")),
                    onError: (error) => toast.error(getErrorMessage(error)),
                  })
                }
              >
                {broadcast.isPending ? t("telegram.publishing") : t("telegram.publish")}
              </Button>
              {options.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("telegram.noAuctions")}</p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("telegram.setupNote")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

