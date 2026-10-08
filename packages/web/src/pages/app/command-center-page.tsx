import { AlertTriangle, ArrowUpRight, Inbox, Scale, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { useCommandCenterExceptions } from "@/features/operations/queries";
import { formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const sourceIcons = {
  verification: ShieldCheck,
  deposit: WalletCards,
  dispute: Scale,
  anomaly: AlertTriangle,
};

const sourceLabels = {
  verification: "KYC",
  deposit: "Deposit",
  dispute: "Dispute",
  anomaly: "Anomaly",
};

export default function CommandCenterPage() {
  const commandCenter = useCommandCenterExceptions();
  const items = commandCenter.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Exception Command Center"
        description="A prioritized view of unresolved KYC, deposit, dispute, and anomaly records across the selected organization."
        meta={
          <Badge variant="warning">{items.length} open exception{items.length === 1 ? "" : "s"}</Badge>
        }
      />

      {commandCenter.isLoading ? <PageSkeleton rows={6} /> : null}
      {commandCenter.isError ? (
        <ErrorState error={commandCenter.error} onRetry={() => void commandCenter.refetch()} />
      ) : null}

      {!commandCenter.isLoading && !commandCenter.isError ? (
        <>
          {items.length === 0 ? (
            <EmptyState
              title="No operational exceptions"
              description="All currently visible verification, deposit, dispute, and anomaly records are resolved."
              icon={Inbox}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exception</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const SourceIcon = sourceIcons[item.source];
                    return (
                      <TableRow key={`${item.source}:${item.id}`}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.title}</p>
                            <p className="mt-1 text-xs capitalize text-muted-foreground">
                              {item.status.replaceAll("_", " ")}
                              {item.auctionId ? ` · Auction ${item.auctionId}` : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <SourceIcon className="size-4 text-muted-foreground" aria-hidden />
                            {sourceLabels[item.source]}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "warning" : "secondary"}
                          >
                            {item.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(item.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={item.actionPath}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            Review <ArrowUpRight className="size-3.5" aria-hidden />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
