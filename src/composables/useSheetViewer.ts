import { ref } from 'vue';

interface SheetViewerPayload {
  blob: Blob;
  fileName: string;
  sheetLabel: string;
  totalLabels: number;
  pageCount: number;
  labelsPerPage: number;
  emptyOnLastPage: number;
}

// Module-level singleton state — every consumer of useSheetViewer
// reads / writes the same refs. Triggering a sheet print from anywhere
// (Print popup, Output tab Print section) opens the same modal hosted
// by AppShell.
const open = ref(false);
const payload = ref<SheetViewerPayload | null>(null);

export function useSheetViewer() {
  function show(next: SheetViewerPayload): void {
    payload.value = next;
    open.value = true;
  }

  function close(): void {
    open.value = false;
    // Keep payload around briefly so the modal close transition can
    // still render its content; cleared on next show.
  }

  return { open, payload, show, close };
}

export type { SheetViewerPayload };
