import { useMemo, useState } from "react";
import { ArrowUpRight, Download, LoaderCircle, Search, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { auditApi } from "@/lib/api/resources";
import { getErrorMessage } from "@/lib/api/errors";
import type { AuditEvent } from "@/lib/api/types";
import { formatDateTime, statusLabel } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-provider";
import { useAuditEvents, useAuditVerify } from "@/features/operations/queries";
import { useT } from "@/i18n/context";

const PAGE_SIZE = 50;

function describeEvent(event: AuditEvent) {
  return event.action.replaceAll(".", " ").replaceAll("_", " ");
}

export default function AuditPage() {
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { roles } = useAuth();
  const canVerify = roles.some((role) => ["compliance_officer", "org_admin", "super_admin"].includes(role));
  const query = useAuditEvents(page, PAGE_SIZE);
  const verify = useAuditVerify(canVerify);
  const t = useT("account");
  const events = query.data?.items;
  const total = query.data?.total ?? 0;
  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const items = events ?? [];
    if (!needle) return items;
    return items.filter((event) =>
      [
        event.action,
        event.entityType,
        event.entityId,
        event.actorRole,
        event.sequenceNo,
        event.auctionId,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(needle)),
    );
  }, [events, search]);
  const chain = verify.data;
  const status = verify.isLoading
    ? { label: t("audit.checking"), tone: "muted" as const, Icon: LoaderCircle }
    : !canVerify
      ? { label: t("audit.verifyRestricted"), tone: "muted" as const, Icon: ShieldAlert }
    : verify.isError
      ? { label: t("audit.couldNotVerify"), tone: "warning" as const, Icon: ShieldAlert }
      : chain?.intact === true
        ? { label: t("audit.intact"), tone: "success" as const, Icon: ShieldCheck }
        : chain?.intact === false
          ? { label: t("audit.issue"), tone: "destructive" as const, Icon: ShieldX }
          : { label: t("audit.received"), tone: "muted" as const, Icon: ShieldAlert };

  async function downloadAnalytics() {
    setExporting(true);
    try {
      const blob = await auditApi.exportAnalytics();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "organization-audit-analytics-90d.csv";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("audit.exported"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("audit.title")}
        description={t("audit.description")}
        actions={
          <Button variant="outline" loading={exporting} onClick={() => void downloadAnalytics()}>
            {!exporting ? <Download aria-hidden /> : null}
            {t("audit.exportAnalytics")}
          </Button>
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]" aria-label={t("audit.integrity")}>
        <Card>
          <CardContent className="flex h-full flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0">
              <p className="font-semibold">{t("audit.integrity")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("audit.integrityHint")}</p>
              {chain ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("audit.checkedEvents", { count: chain.eventCount })}
                  {chain.brokenAtSequence !== undefined
                    ? ` · ${t("audit.brokenAt", { sequence: chain.brokenAtSequence })}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={status.tone} role="status" className="text-sm">
                <status.Icon className={verify.isLoading ? "animate-spin" : undefined} aria-hidden />
                {status.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col justify-center p-4 sm:p-5">
            <p className="eyebrow text-muted-foreground">{t("audit.analyticsTitle")}</p>
            <p className="mt-1 font-semibold">{t("audit.analyticsPeriod")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("audit.analyticsDescription")}</p>
          </CardContent>
        </Card>
      </section>

      {verify.isError ? <ErrorState className="mb-5" error={verify.error} onRetry={() => void verify.refetch()} /> : null}

      <section className="space-y-4" aria-label={t("audit.eventsTitle")} aria-busy={query.isFetching}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("audit.eventsTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("audit.eventsDescription")}</p>
          </div>
          <div className="w-full sm:max-w-sm">
            <Label htmlFor="audit-search">{t("audit.filterEvents")}</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="audit-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("audit.filterPlaceholder")}
                className="pl-9"
                aria-controls="audit-events"
              />
            </div>
          </div>
        </div>

        {query.isLoading ? (
          <PageSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="font-medium">{(events?.length ?? 0) ? t("audit.noMatches") : t("audit.noEvents")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(events?.length ?? 0) ? t("audit.noMatchesHint") : t("audit.noEventsHint")}
              </p>
              {(events?.length ?? 0) > 0 && search ? (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>{t("audit.clearFilter")}</Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <>
            <p id="audit-events-count" className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t("audit.eventCount", { shown: filteredEvents.length, loaded: events?.length ?? 0, total })}
            </p>
            <ol id="audit-events" className="space-y-3">
              {filteredEvents.map((event) => (
                <li key={event.id}>
                  <AuditEventCard event={event} />
                </li>
              ))}
            </ol>
            <Pagination
              page={page}
              pages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              total={total}
              noun={t("audit.eventsNoun")}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function AuditEventCard({ event }: { event: AuditEvent }) {
  const t = useT("account");
  const action = describeEvent(event);
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono tabular-nums">#{event.sequenceNo}</Badge>
            <h3 className="font-semibold capitalize">{action}</h3>
            <Badge variant="outline">{statusLabel(event.actorRole)}</Badge>
          </div>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{event.entityType.replaceAll("_", " ")}</span>
            <span aria-hidden> · </span>
            <span className="font-mono text-xs">{event.entityId}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
            {event.auctionId ? (
              <>
                <span aria-hidden>·</span>
                <Link to={`/app/auctions/${event.auctionId}`} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  {t("audit.openAuction")} <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="min-w-0 border-t pt-3 sm:max-w-64 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <p className="eyebrow text-muted-foreground">{t("audit.eventHash")}</p>
          <p className="mt-1 break-all font-mono text-xs text-foreground" title={event.hash}>{event.hash}</p>
        </div>
      </CardContent>
    </Card>
  );
}
