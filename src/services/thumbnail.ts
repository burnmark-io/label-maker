import type { useDesignerStore } from '@/stores/designer';

type Designer = ReturnType<typeof useDesignerStore>;

const THUMBNAIL_SCALE = 0.25;

/**
 * Render the current canvas to a small data URL suitable for storing
 * alongside a library entry. Returns `undefined` if rendering throws —
 * callers should treat the absence of a thumbnail as non-blocking.
 *
 * Used by the toolbar's Save dropdown, the library modal's persist path,
 * and the import flow's "Save & open" branch.
 */
export async function captureCanvasThumbnail(designer: Designer): Promise<string | undefined> {
  try {
    const blob = await designer.exportPng(undefined, THUMBNAIL_SCALE);
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
