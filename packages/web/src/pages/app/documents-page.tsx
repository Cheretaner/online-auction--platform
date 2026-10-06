import { useState } from "react";
import { Search, SearchX } from "lucide-react";
import { EmptyState, QueryState } from "@/components/feedback/query-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentRow } from "@/features/documents/auction-documents";
import { useMyDocuments, usePlatformCapabilities } from "@/features/operations/queries";
import { useT } from "@/i18n/context";

export default function DocumentsPage() {
  const query = useMyDocuments();
  const uploads = usePlatformCapabilities();
  const [search, setSearch] = useState("");
  const t = useT("account");
  const tc = useT("common");
  const items = query.data?.items ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? items.filter((document) => document.fileName.toLowerCase().includes(normalizedSearch))
    : items;

  return (
    <div>
      <PageHeader
        title={t("lists.documentsTitle")}
        description={t("lists.documentsDescription")}
        meta={
          query.isSuccess ? (
            <Badge variant="secondary">{t("lists.documentsCount", { count: items.length })}</Badge>
          ) : undefined
        }
      />
      {uploads.isPending ? (
        <p className="mb-4 text-sm text-muted-foreground" role="status">{tc("checkingDocumentUploads")}</p>
      ) : uploads.isError || !uploads.data?.documentUploadsEnabled ? (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>
            {uploads.isError ? tc("documentUploadsStatusUnknown") : tc("documentUploadsUnavailable")}
          </AlertTitle>
        </Alert>
      ) : null}
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={items.length === 0}
        emptyTitle={t("lists.documentsTitle")}
        emptyDescription={t("lists.documentsEmpty")}
        emptyIcon={SearchX}
        onRetry={() => void query.refetch()}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Label htmlFor="document-search" className="sr-only">
                {t("lists.documentsSearch")}
              </Label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="document-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("lists.documentsSearchPlaceholder")}
                className="pl-9"
                aria-controls="documents-results"
              />
            </div>
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t("lists.documentsCount", { count: filtered.length })}
            </p>
          </div>
          <div id="documents-results">
            {filtered.length ? (
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <ul className="divide-y">
                    {filtered.map((document) => (
                      <DocumentRow key={document.id} doc={document} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                size="inline"
                icon={SearchX}
                title={t("lists.documentsNoMatches")}
                description={t("lists.documentsNoMatchesBody")}
                action={
                  <Button variant="outline" onClick={() => setSearch("")}>
                    {t("lists.clearSearch")}
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
