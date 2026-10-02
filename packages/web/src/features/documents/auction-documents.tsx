import { useRef, useState } from "react";
import { DOCUMENT_TYPES, type DocumentType } from "@auction/shared";
import { Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {doc.isPrivate ? <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Private" /> : null}
          {doc.fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {doc.documentType.replaceAll("_", " ")} · {formatSize(doc.fileSizeBytes)} · {formatDateTime(doc.createdAt)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          downloadDocument(doc.id, doc.fileName)
            .catch((error: unknown) => toast.error(getErrorMessage(error, "Download failed")))
            .finally(() => setBusy(false));
        }}
      >
        <Download className="size-4" aria-hidden /> {busy ? "Downloading…" : "Download"}
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
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : docs.isError ? (
        <p className="text-sm text-destructive">{getErrorMessage(docs.error, "Documents could not be loaded")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents published yet.</p>
      ) : (
        <ul>
          {items.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}

      {canUpload ? (
        <form
          className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
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
            <Label htmlFor={`doc-file-${auctionId}`}>File (max 20 MB)</Label>
            <input
              id={`doc-file-${auctionId}`}
              ref={fileRef}
              type="file"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={docType} onValueChange={(value) => setDocType(value as DocumentType)}>
              <SelectTrigger aria-label="Document type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.filter((type) => !["identity_document", "deposit_release_evidence"].includes(type)).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <Switch checked={publicDoc} onCheckedChange={setPublicDoc} />
            Publish to bidders (turn off for internal documents)
          </label>
        </form>
      ) : null}
    </div>
  );
}
