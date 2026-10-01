import { useRef, useState } from "react";
import { DOCUMENT_TYPES, type DocumentType } from "@auction/shared";
import { Download, FolderOpen, Lock } from "lucide-react";
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
import { formatDateTime } from "@/lib/format";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentRow({ doc }: { doc: DocumentRecord }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {doc.isPrivate ? <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Private" /> : null}
          {doc.fileName}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {doc.documentType.replaceAll("_", " ")} · {formatSize(doc.fileSizeBytes)} · {formatDateTime(doc.createdAt)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        loading={busy}
        onClick={() => {
          setBusy(true);
          downloadDocument(doc.id, doc.fileName)
            .catch((error: unknown) => toast.error(getErrorMessage(error, "Download failed")))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? null : <Download aria-hidden />}
        {busy ? "Downloading…" : "Download"}
      </Button>
    </li>
  );
}

/** The auction's document pack. Staff also get an upload form; the API
 * decides what each viewer may see. */
export function AuctionDocuments({ auctionId, canUpload }: { auctionId: string; canUpload?: boolean }) {
  const docs = useAuctionDocuments(auctionId);
  const upload = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("specification");
  const [publicDoc, setPublicDoc] = useState(true);

  const items = docs.data?.items ?? [];

  return (
    <div className="space-y-4">
      {docs.isLoading ? (
        <PageSkeleton rows={2} />
      ) : docs.isError ? (
        <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState size="inline" icon={FolderOpen} title="No documents published yet" />
      ) : (
        <ul>
          {items.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}

      {canUpload ? (
        <form
          className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) {
              toast.error("Choose a file to upload");
              return;
            }
            const form = new FormData();
            form.set("file", file);
            form.set("docType", docType);
            form.set("auctionId", auctionId);
            form.set("isPrivate", publicDoc ? "false" : "true");
            upload.mutate(form, {
              onSuccess: () => {
                toast.success("Document uploaded");
                if (fileRef.current) fileRef.current.value = "";
              },
              onError: (error) => toast.error(getErrorMessage(error, "Upload failed")),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`doc-file-${auctionId}`}>File</Label>
            <Input id={`doc-file-${auctionId}`} ref={fileRef} type="file" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`doc-type-${auctionId}`}>Type</Label>
            <Select value={docType} onValueChange={(value) => setDocType(value as DocumentType)}>
              <SelectTrigger id={`doc-type-${auctionId}`} className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
          <div className="flex items-start gap-3 sm:col-span-3">
            <Switch id={`doc-public-${auctionId}`} checked={publicDoc} onCheckedChange={setPublicDoc} />
            <div>
              <Label htmlFor={`doc-public-${auctionId}`}>Publish to bidders</Label>
              <FieldHint>Up to 20 MB. Turn off for internal documents only staff should see.</FieldHint>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
