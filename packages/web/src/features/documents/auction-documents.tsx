import { useRef, useState } from "react";
import { DOCUMENT_TYPES, type DocumentType } from "@auction/shared";
import { Download, Lock, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          {doc.documentType.replaceAll("_", " ")} &middot; {formatSize(doc.fileSizeBytes)} &middot; {formatDateTime(doc.createdAt)}
          
          {doc.ocrStatus === "processing" && (
            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 rounded-sm">
              <Loader2 className="size-3 animate-spin" /> OCR Processing
            </span>
          )}
          {doc.ocrStatus === "failed" && (
            <span className="text-destructive bg-destructive/10 px-1.5 rounded-sm">OCR Failed</span>
          )}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {doc.ocrStatus === "completed" && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-1.5">
                <FileText className="size-4" aria-hidden /> View Text
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl flex flex-col">
              <DialogHeader>
                <DialogTitle>Extracted Text: {doc.fileName}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 p-4 rounded-md border bg-muted/50 overflow-y-auto max-h-[65vh]">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                  {doc.extractedText?.trim() || "No text could be extracted from this document."}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
        )}

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
          <Download className="size-4" aria-hidden /> {busy ? "Downloading..." : "Download"}
        </Button>
      </div>
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
        <p className="text-sm text-muted-foreground">Loading documents...</p>
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
              type="file"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              ref={fileRef}
              accept="application/pdf,image/jpeg,image/png,image/tiff,image/bmp,image/webp"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`doc-type-${auctionId}`}>Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger id={`doc-type-${auctionId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? "Uploading..." : "Upload"}
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
