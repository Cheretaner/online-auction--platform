import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-provider";
import { useOrgAuctions } from "@/features/auctions/queries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

export default function WorkspaceAuctionsPage() {
  const { organizationId } = useAuth();
  const auctions = useOrgAuctions(organizationId ?? undefined);

  return (
    <div>
      <PageHeader
        title="Workspace auctions"
        description="Organization-scoped list. Requires an organization on the access token."
        actions={
          <Button asChild>
            <Link to="/app/auctions/new">Create</Link>
          </Button>
        }
      />
      {!organizationId ? (
        <p className="text-sm text-destructive">Choose an organization context first.</p>
      ) : (
        <QueryState
          isLoading={auctions.isLoading}
          isError={auctions.isError}
          error={auctions.error}
          isEmpty={(auctions.data?.items.length ?? 0) === 0}
          emptyTitle="No auctions for this organization"
          onRetry={() => auctions.refetch()}
        >
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Closes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auctions.data?.items.map((auction) => (
                  <TableRow key={auction.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" to={`/app/auctions/${auction.id}`}>
                        {auction.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={auction.status} />
                    </TableCell>
                    <TableCell>{formatMoney(auction.currentHighestBid ?? auction.startPrice)}</TableCell>
                    <TableCell>{formatDateTime(auction.closesAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {auctions.data?.items.map((auction) => (
              <Card key={auction.id}>
                <CardContent className="space-y-2 pt-6">
                  <Link className="font-medium" to={`/app/auctions/${auction.id}`}>
                    {auction.title}
                  </Link>
                  <StatusBadge status={auction.status} />
                  <p className="text-sm text-muted-foreground">{formatMoney(auction.startPrice)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </QueryState>
      )}
    </div>
  );
}
