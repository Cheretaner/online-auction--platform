import { documentsApi } from "@/lib/api/resources";

/** Downloads a stored document through the authenticated API and hands it to
 * the browser as a file. A plain link cannot be used because the request
 * needs the bearer token. */
export async function downloadDocument(id: string, fileName: string): Promise<void> {
  const blob = await documentsApi.download(id);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
