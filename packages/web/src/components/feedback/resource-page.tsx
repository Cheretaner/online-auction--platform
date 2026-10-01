import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getErrorMessage } from "@/lib/api/errors";

type ResourceQuery<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

export function ResourcePage<T>({
  title,
  description,
  query,
  emptyDescription = "Records will appear here as soon as there is activity on your account.",
  children,
}: {
  title: string;
  description: string;
  emptyDescription?: string;
  query: ResourceQuery<{ items: T[] } | T | null>;
  children?: ReactNode;
}) {
  const data = query.data;
  const rows =
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray(data.items)
      ? data.items
      : data == null
        ? []
        : [data];
  return (
    <div>
      <PageHeader title={title} description={description} />
      {children}
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyTitle={`No ${title.toLowerCase()} yet`}
        emptyDescription={emptyDescription}
        onRetry={() => void query.refetch()}
      >
        <div className="space-y-3">
          {rows.map((row, index) => (
            <ResourceRecord key={recordId(row) ?? index} value={row} />
          ))}
        </div>
      </QueryState>
      {query.isError ? (
        <p className="sr-only" role="status">
          {getErrorMessage(query.error)}
        </p>
      ) : null}
    </div>
  );
}

function recordId(value: unknown): string | undefined {
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  return undefined;
}

function ResourceRecord({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const hiddenField =
    /^(id|.*Id|email|phone|documentNumber|nationalId|tinNumber|token|hash|checksum|storagePath|uploadedBy|createdBy|reviewedBy|actorId|assignedTo|openedBy)$/i;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, item]) =>
      !hiddenField.test(key) &&
      item != null &&
      ["string", "number", "boolean"].includes(typeof item),
  );
  const titleEntry = entries.find(([key]) => /title|name|type/i.test(key));
  const statusEntry = entries.find(([key]) => /status/i.test(key));
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="leading-snug font-medium first-letter:uppercase">
            {titleEntry ? String(titleEntry[1] ?? "Untitled") : "Record"}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-xs text-muted-foreground sm:grid-cols-2">
            {entries
              .filter(
                ([key]) => key !== titleEntry?.[0] && key !== statusEntry?.[0],
              )
              .slice(0, 4)
              .map(([key, item]) => (
                <div className="min-w-0" key={key}>
                  <dt className="eyebrow">{humanize(key)}</dt>
                  <dd className="mt-0.5 truncate font-medium text-foreground">
                    {formatRecordValue(key, item)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
        {statusEntry ? <StatusBadge status={String(statusEntry[1])} className="self-start" /> : null}
      </CardContent>
    </Card>
  );
}

function humanize(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatRecordValue(key: string, value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (
    typeof value === "string" &&
    key.endsWith("At") &&
    !Number.isNaN(Date.parse(value))
  ) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
  return typeof value === "string" ? value.replaceAll("_", " ") : String(value);
}
