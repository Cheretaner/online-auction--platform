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
import { useT } from "@/i18n/context";

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
                      {t("telegram.codeExpires", { date: formatDateTime(link.expiresAt) })}
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
  const { session } = useAuth();
  const orgId = session?.organizationId ?? undefined;
  const auctions = useOrgAuctions(orgId);
  const options = auctions.data?.items ?? [];
  const broadcast = useTelegramBroadcast();
  const [auctionId, setAuctionId] = useState<string>(NO_AUCTION);
  const selected = auctionId === NO_AUCTION ? undefined : auctionId;
  const t = useT("tools");

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

