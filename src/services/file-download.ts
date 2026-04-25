/**
 * Trigger a browser download for a Blob. Uses an off-DOM `<a download>`
 * link so the browser's native save dialog appears (or the file lands
 * straight in the configured download folder).
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  // Append for Firefox compatibility, then remove right after the click.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke — the browser keeps the URL alive briefly to start the
  // download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(input: string, fallback = 'label'): string {
  const trimmed = input.trim().toLowerCase();
  const cleaned = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}
