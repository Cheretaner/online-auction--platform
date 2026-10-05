import { useEffect, useRef, useState } from "react";
import { Eye, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { documentsApi } from "@/lib/api/resources";
import { useT } from "@/i18n/context";

function supportedMime(mimeType: string | undefined, fileName: string): string | null {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime === "application/pdf" || mime.startsWith("image/")) return mime;
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension ?? "")) {
    return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  }
  return null;
}

export function DocumentPreviewButton({
  documentId,
  fileName,
  mimeType,
  size = "sm",
  allowUnknown = false,
}: {
  documentId: string;
  fileName: string;
  mimeType?: string;
  size?: "sm" | "icon";
  allowUnknown?: boolean;
}) {
  const t = useT("common");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);
  const expectedType = supportedMime(mimeType, fileName);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  if (!expectedType && !allowUnknown) return null;

  async function openPreview() {
    setError(null);
    if (url) {
      setOpen(true);
      return;
    }
    setLoading(true);
    try {
      const blob = await documentsApi.download(documentId);
      const actualType = blob.type.toLowerCase().split(";")[0] || expectedType || "";
      if (actualType !== "application/pdf" && !actualType.startsWith("image/")) {
        throw new Error(t("previewUnsupported"));
      }
      const objectUrl = URL.createObjectURL(blob);
      urlRef.current = objectUrl;
      setUrl(objectUrl);
      setPreviewType(actualType);
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("previewFailed"));
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function closePreview(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl(null);
      setPreviewType(null);
    }
  }

  return (
    <>
      <Button type="button" size={size} variant="outline" onClick={() => void openPreview()} disabled={loading}>
        {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        {size === "icon" ? <span className="sr-only">{t("preview")}</span> : t("preview")}
      </Button>
      <Dialog open={open} onOpenChange={closePreview}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-5xl gap-3 p-3 sm:w-[calc(100%-2rem)] sm:p-5">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
            <DialogDescription>{t("documentPreviewDescription")}</DialogDescription>
          </DialogHeader>
          {url && previewType?.startsWith("image/") ? (
            <div className="grid max-h-[78svh] min-h-0 place-items-center overflow-auto rounded-md bg-muted/50 p-2">
              <img src={url} alt={fileName} className="max-h-[74svh] max-w-full object-contain" />
            </div>
          ) : url && previewType === "application/pdf" ? (
            <iframe src={url} title={fileName} className="h-[78svh] w-full rounded-md border bg-white" />
          ) : error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
