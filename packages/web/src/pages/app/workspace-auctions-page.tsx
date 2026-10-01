import { Link } from "react-router-dom";
import { Building2, Gavel, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-provider";
import { useOrgAuctions } from "@/features/auctions/queries";
import type { Auction } from "@/lib/api/types";
import { canManageAuctions, formatDateTime, formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";

function displayPrice(auction: Auction) {
  return formatMoney(auction.currentHighestBid ?? auction.startPrice);
}

export default function WorkspaceAuctionsPage() {
  const { organizationId, roles } = useAuth();
  const auctions = useOrgAuctions(organizationId ?? undefined);
  const canCreate = canManageAuctions(roles);
  const createButton = canCreate ? (
    <Button asChild>
      <Link to="/app/auctions/new">
        <Plus aria-hidden /> Create auction
      </Link>
    </Button>
  ) : null;

  return (
    <div>
      <PageHeader
        title="Workspace auctions"
        description="Every auction your organization has drafted, published or closed."
        actions={organizationId ? createButton : null}
      />
      {!organizationId ? (
        <EmptyState
          icon={Building2}
          title="Choose an organization first"
          description="Auctions belong to an organization. Pick one with the organization switcher in the top bar."
        />
      ) : (
        <QueryState
          isLoading={auctions.isLoading}
          isError={auctions.isError}
          error={auctions.error}
          isEmpty={(auctions.data?.items.length ?? 0) === 0}
          emptyIcon={Gavel}
          emptyTitle="No auctions for this organization yet"
          emptyDescription={canCreate ? "Start with a draft. Nothing is public until a second person approves it." : undefined}
          emptyAction={createButton}
          onRetry={() => auctions.refetch()}
        >
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Closes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auctions.data?.items.map((auction) => (
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
            {auctions.data?.items.map((auction) => (
              <li key={auction.id}>
                <Link to={`/app/auctions/${auction.id}`} className="block rounded-lg">
                  <Card interactive className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{auction.title}</p>
                      <StatusBadge status={auction.status} />
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium tabular-nums">{displayPrice(auction)}</span>
                      <span className="text-muted-foreground">Closes {formatDateTime(auction.closesAt)}</span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </QueryState>
      )}
    </div>
  );
}
