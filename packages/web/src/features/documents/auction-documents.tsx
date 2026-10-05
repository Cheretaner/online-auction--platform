import { useRef, useState } from "react";
import { DOCUMENT_TYPES, type DocumentType } from "@auction/shared";
import { Download, FileText, FolderOpen, Lock, Search } from "lucide-react";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldHint, Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuctionDocuments, useUploadDocument } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { DocumentRecord } from "@/lib/api/types";
import { downloadDocument } from "@/lib/download";
import { DocumentPreviewButton } from "@/features/documents/document-preview-button";
import { Textarea } from "@/components/ui/textarea";
import { enumLabel, formatDateTime } from "@/lib/format";
import { useT } from "@/i18n/context";
import { useDocumentOcr, useReviewDocumentOcr, useSearchReviewedOcr, useStartDocumentOcr } from "@/features/operations/queries";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const OCR_DOCUMENT_TYPES = new Set<DocumentType>(["specification", "inspection_report", "terms", "other"]);

export function DocumentRow({ doc, canReview = false }: { doc: DocumentRecord; canReview?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [reviewedText, setReviewedText] = useState<string | null>(null);
  const t = useT("auctions");
  const tc = useT("common");
  const ocr = useDocumentOcr(doc.id, canReview && showOcr);
  const startOcr = useStartDocumentOcr(doc.id);
  const reviewOcr = useReviewDocumentOcr(doc.id);
  const supportsOcr = OCR_DOCUMENT_TYPES.has(doc.documentType) &&
    (doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/"));
  const openExtraction = async () => {
    setShowOcr(true);
    const cached = ocr.data;
    if (cached && cached.status !== "failed") {
      setReviewedText(cached.reviewedText ?? cached.extractedText ?? "");
      return;
    }
    try {
      if (!cached) {
        const result = await ocr.refetch();
        if (result.isError) {
          toast.error(getErrorMessage(result.error, t("documents.ocrFailed")));
          return;
        }
        if (result.data && result.data.status !== "failed") {
          setReviewedText(result.data.reviewedText ?? result.data.extractedText ?? "");
          return;
        }
      }
      const { item } = await startOcr.mutateAsync();
      setReviewedText(item.reviewedText ?? item.extractedText ?? "");
    } catch (error) {
      toast.error(getErrorMessage(error, t("documents.ocrFailed")));
    }
  };
  return (
    <li className="border-b py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {doc.isPrivate ? <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("documents.private")} /> : null}
            <span className="min-w-0 break-words">{doc.fileName}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {enumLabel(doc.documentType)} · {formatSize(doc.fileSizeBytes)} · {formatDateTime(doc.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
        {canReview && supportsOcr ? (
          <Button
            size="sm"
            variant="outline"
            aria-expanded={showOcr}
            aria-controls={`ocr-panel-${doc.id}`}
            loading={startOcr.isPending || (!showOcr && ocr.isFetching)}
            disabled={startOcr.isPending || (!showOcr && ocr.isFetching)}
            onClick={() => showOcr ? setShowOcr(false) : void openExtraction()}
          >{showOcr ? t("documents.hideOcr") : ocr.data ? t("documents.viewOcr") : t("documents.extractText")}</Button>
        ) : null}
        <DocumentPreviewButton documentId={doc.id} fileName={doc.fileName} mimeType={doc.mimeType} />
        <Button
          size="sm"
          variant="outline"
          loading={busy}
          onClick={() => {
            setBusy(true);
            downloadDocument(doc.id, doc.fileName)
              .catch((error: unknown) => toast.error(getErrorMessage(error, tc("downloadFailed"))))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? null : <Download aria-hidden />}
          {busy ? tc("downloading") : tc("download")}
        </Button>
        </div>
      </div>
      {showOcr ? (
        <div
          id={`ocr-panel-${doc.id}`}
          className="mt-3 space-y-3 rounded-md border bg-muted/20 p-3"
          aria-busy={ocr.isFetching || startOcr.isPending || reviewOcr.isPending}
        >
          {ocr.isLoading || startOcr.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("documents.ocrChecking")}</p> : null}
          {ocr.isError ? <ErrorState error={ocr.error} onRetry={() => void ocr.refetch()} /> : null}
          {ocr.data?.status === "processing" ? <p role="status" className="text-sm">{t("documents.ocrProcessing")}</p> : null}
          {ocr.data === null && !ocr.isFetching ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("documents.noExtraction")}</p>
              <Button
                size="sm"
                variant="outline"
                loading={startOcr.isPending}
                onClick={() => void startOcr.mutateAsync().then(({ item }) => {
                  setReviewedText(item.reviewedText ?? item.extractedText ?? "");
                }).catch((error: unknown) => toast.error(getErrorMessage(error, t("documents.ocrFailed"))))}
              >{t("documents.extractText")}</Button>
            </div>
          ) : null}
          {ocr.data?.status === "failed" ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">{ocr.data.errorMessage ?? t("documents.ocrFailed")}</p>
              <Button
                size="sm"
                variant="outline"
                loading={startOcr.isPending}
                onClick={() => void startOcr.mutateAsync().then(({ item }) => {
                  setReviewedText(item.reviewedText ?? item.extractedText ?? "");
                }).catch((error: unknown) => toast.error(getErrorMessage(error, t("documents.ocrFailed"))))}
              >{t("documents.retryOcr")}</Button>
            </div>
          ) : null}
          {ocr.data?.status === "completed" ? (
            <>
              <p className="text-xs text-muted-foreground">
                {ocr.data.reviewedAt ? t("documents.humanReviewed") : t("documents.verifyNotice")}
                {ocr.data.confidence !== null ? ` · ${t("documents.confidence", { value: Math.round(ocr.data.confidence) })}` : ""}
                {ocr.data.extractionMethod ? ` · ${t(ocr.data.extractionMethod === "embedded_text" ? "documents.embeddedText" : "documents.ocrMethod")}` : ""}
              </p>
              <Textarea
                value={reviewedText ?? ocr.data.reviewedText ?? ocr.data.extractedText ?? ""}
                onChange={(event) => setReviewedText(event.target.value)}
                rows={10}
                maxLength={500_000}
                aria-label={t("documents.extractedText")}
                readOnly={Boolean(ocr.data.reviewedAt)}
              />
              {!ocr.data.reviewedAt ? (
                <Button
                  size="sm"
                  loading={reviewOcr.isPending}
                  disabled={!(reviewedText ?? ocr.data.extractedText ?? "").trim()}
                  onClick={() => void reviewOcr.mutateAsync(reviewedText ?? ocr.data?.extractedText ?? "")
                    .then(({ item }) => {
                      setReviewedText(item.reviewedText ?? "");
                      toast.success(t("documents.ocrReviewed"));
                    })
                    .catch((error: unknown) => toast.error(getErrorMessage(error, t("documents.ocrFailed"))))}
                >{t("documents.confirmOcr")}</Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The auction's document pack. Staff also get an upload form; the API
 * decides what each viewer may see. */
export function AuctionDocuments({ auctionId, canUpload, canReview }: { auctionId: string; canUpload?: boolean; canReview?: boolean }) {
  const docs = useAuctionDocuments(auctionId);
  const upload = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("specification");
  const [publicDoc, setPublicDoc] = useState(true);
  const [ocrQuery, setOcrQuery] = useState("");
  const [ocrSearch, setOcrSearch] = useState("");
  const t = useT("auctions");
  const tc = useT("common");

  const items = docs.data?.items ?? [];
  const ocrResults = useSearchReviewedOcr(auctionId, ocrSearch);

  return (
    <div className="space-y-4">
      {docs.isLoading ? (
        <PageSkeleton rows={2} />
      ) : docs.isError ? (
        <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState size="inline" icon={FolderOpen} title={t("documents.none")} />
      ) : (
        <ul>
          {items.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} canReview={canReview} />
          ))}
        </ul>
      )}

      {canReview ? (
        <section className="space-y-3 rounded-lg border p-4" aria-label={t("documents.searchOcr")}>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
            event.preventDefault();
            setOcrSearch(ocrQuery.trim());
          }}>
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor={`ocr-search-${auctionId}`}>{t("documents.searchOcr")}</Label>
              <Input id={`ocr-search-${auctionId}`} type="search" value={ocrQuery} onChange={(event) => setOcrQuery(event.target.value)} minLength={2} maxLength={120} />
            </div>
            <Button type="submit" variant="outline" disabled={ocrQuery.trim().length < 2} loading={ocrResults.isFetching}>
              {!ocrResults.isFetching ? <Search aria-hidden /> : null}
              {t("documents.search")}
            </Button>
          </form>
          {ocrSearch ? (
            <div aria-busy={ocrResults.isFetching}>
            {ocrResults.isError ? <ErrorState error={ocrResults.error} onRetry={() => void ocrResults.refetch()} /> :
            ocrResults.isLoading ? <p role="status" className="text-sm text-muted-foreground">{tc("loading")}</p> :
            ocrResults.data?.items.length ? (
              <ul className="space-y-2 text-sm">
                {ocrResults.data.items.map((hit) => (
                  <li key={hit.documentId} className="rounded-md bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{hit.fileName}</p>
                      <DocumentPreviewButton documentId={hit.documentId} fileName={hit.fileName} mimeType={hit.mimeType} />
                    </div>
                    <p className="mt-1 text-muted-foreground">{hit.excerpt}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("documents.humanReviewed")} · {formatDateTime(hit.reviewedAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{t("documents.noOcrMatches")}</p>}
            </div>
          ) : null}
        </section>
      ) : null}

      {canUpload ? (
        <form
          className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) {
              toast.error(t("documents.chooseFile"));
              return;
            }
            if (file.size > 20 * 1024 * 1024) {
              toast.error(t("documents.uploadLimit"));
              return;
            }
            const form = new FormData();
            form.set("file", file);
            form.set("docType", docType);
            form.set("auctionId", auctionId);
            form.set("isPrivate", publicDoc ? "false" : "true");
            upload.mutate(form, {
              onSuccess: () => {
                toast.success(t("documents.uploaded"));
                if (fileRef.current) fileRef.current.value = "";
              },
              onError: (error) => toast.error(getErrorMessage(error, tc("uploadFailed"))),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`doc-file-${auctionId}`}>{t("documents.file")}</Label>
            <Input
              id={`doc-file-${auctionId}`}
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              aria-describedby={`doc-file-hint-${auctionId}`}
              disabled={upload.isPending}
            />
            <FieldHint id={`doc-file-hint-${auctionId}`}>{t("documents.uploadHint")}</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`doc-type-${auctionId}`}>{t("documents.type")}</Label>
            <Select value={docType} onValueChange={(value) => setDocType(value as DocumentType)}>
              <SelectTrigger id={`doc-type-${auctionId}`} className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.filter((type) => !["identity_document", "deposit_release_evidence"].includes(type)).map((type) => (
                  <SelectItem key={type} value={type}>
                    {enumLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={upload.isPending} disabled={upload.isPending}>
            {upload.isPending ? t("documents.uploading") : t("documents.upload")}
          </Button>
          <div className="flex items-start gap-3 sm:col-span-3">
            <Switch id={`doc-public-${auctionId}`} checked={publicDoc} onCheckedChange={setPublicDoc} />
            <div>
              <Label htmlFor={`doc-public-${auctionId}`}>{t("documents.publish")}</Label>
              <FieldHint>{t("documents.publishHint")}</FieldHint>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
