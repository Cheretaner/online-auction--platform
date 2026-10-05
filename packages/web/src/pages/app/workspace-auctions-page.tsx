import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Gavel, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useAuth } from "@/features/auth/auth-provider";
import { useOrgAuctions } from "@/features/auctions/queries";
import type { Auction } from "@/lib/api/types";
import { canManageAuctions, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { useT } from "@/i18n/context";

function displayPrice(auction: Auction) {
  return formatMoney(auction.currentHighestBid ?? auction.startPrice);
}

export default function WorkspaceAuctionsPage() {
  const { organizationId, roles } = useAuth();
  const auctions = useOrgAuctions(organizationId ?? undefined);
  const canCreate = canManageAuctions(roles);
  const t = useT("workspace");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const items = auctions.data?.items;
  const filteredAuctions = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (items ?? []).filter((auction) =>
      (!normalized || auction.title.toLocaleLowerCase().includes(normalized)) &&
      (!status || auction.status === status),
    );
  }, [items, search, status]);
  const createButton = canCreate ? (
    <Button asChild>
      <Link to="/app/auctions/new">
        <Plus aria-hidden /> {t("list.create")}
      </Link>
    </Button>
  ) : null;

  return (
    <div>
      <PageHeader
        title={t("list.title")}
        description={t("list.description")}
        actions={organizationId ? createButton : null}
      />
      {!organizationId ? (
        <EmptyState
          icon={Building2}
          title={t("list.chooseOrgTitle")}
          description={t("list.chooseOrgBody")}
        />
      ) : (
        <QueryState
          isLoading={auctions.isLoading}
          isError={auctions.isError}
          error={auctions.error}
          isEmpty={(auctions.data?.items.length ?? 0) === 0}
          emptyIcon={Gavel}
          emptyTitle={t("list.emptyTitle")}
          emptyDescription={canCreate ? t("list.emptyBody") : undefined}
          emptyAction={createButton}
          onRetry={() => auctions.refetch()}
        >
          <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="workspace-auction-search" className="mb-1.5 block">{t("list.search")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="workspace-auction-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("list.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full space-y-1.5 sm:w-56">
              <Label htmlFor="workspace-auction-status">{t("list.filterStatus")}</Label>
              <NativeSelect id="workspace-auction-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">{t("list.allStatuses")}</option>
                {["draft", "pending_review", "scheduled", "live", "closed", "under_review", "awarded", "cancelled"].map((value) => (
                  <option key={value} value={value}>{statusLabel(value)}</option>
                ))}
              </NativeSelect>
            </div>
            <p className="pb-2 text-sm text-muted-foreground sm:whitespace-nowrap" role="status" aria-live="polite">
              {t("list.matchingCount", { count: filteredAuctions.length })}
            </p>
          </div>
          {(items?.length ?? 0) > 0 && filteredAuctions.length === 0 ? (
            <EmptyState
              size="inline"
              icon={Gavel}
              title={t("list.noMatches")}
              action={
                <Button variant="outline" onClick={() => { setSearch(""); setStatus(""); }}>
                  {t("list.clearFilters")}
                </Button>
              }
            />
          ) : null}
          {filteredAuctions.length > 0 ? <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.colTitle")}</TableHead>
                  <TableHead>{t("list.colStatus")}</TableHead>
                  <TableHead className="text-right">{t("list.colPrice")}</TableHead>
                  <TableHead>{t("list.colCloses")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuctions.map((auction) => (
                  <TableRow key={auction.id}>
                    <TableCell className="max-w-md">
                      <Link
                        className="rounded-sm font-medium underline-offset-4 hover:text-primary hover:underline"
                        to={`/app/auctions/${auction.id}`}
                      >
                        {auction.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={auction.status} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{displayPrice(auction)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(auction.closesAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {filteredAuctions.map((auction) => (
              <li key={auction.id}>
                <Link to={`/app/auctions/${auction.id}`} className="block rounded-lg">
                  <Card interactive className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{auction.title}</p>
                      <StatusBadge status={auction.status} />
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium tabular-nums">{displayPrice(auction)}</span>
                      <span className="text-muted-foreground">{t("list.closesOn", { date: formatDateTime(auction.closesAt) })}</span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          </> : null}
        </QueryState>
      )}
    </div>
  );
}
