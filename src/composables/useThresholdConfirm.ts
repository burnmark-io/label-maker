import { ref } from 'vue';

/**
 * Default count threshold for the "are you sure?" gate. Plan §8: warn
 * when count > THRESHOLD. Per-session don't-ask-again only.
 */
export const DEFAULT_THRESHOLD = 20;

interface ThresholdContext {
  count: number;
  destination: 'thermal' | 'sheet';
  /** Thermal printer model, if connected. */
  printerModel?: string | null;
  /** Sheet template label ("Avery L7160"), if destination is sheet. */
  sheetLabel?: string | null;
  /** Page count when destination is sheet. */
  pageCount?: number;
}

const open = ref(false);
const context = ref<ThresholdContext | null>(null);
const skipForSession = ref(false);
let resolver: ((ok: boolean) => void) | null = null;

/**
 * Show the threshold confirmation. Returns `true` when the user
 * confirms, `false` when they cancel. If the user has previously
 * checked "Don't ask again" this session, resolves immediately as
 * `true` without re-prompting.
 */
function confirmIfNeeded(ctx: ThresholdContext): Promise<boolean> {
  if (ctx.count <= DEFAULT_THRESHOLD) return Promise.resolve(true);
  if (skipForSession.value) return Promise.resolve(true);
  context.value = ctx;
  open.value = true;
  return new Promise<boolean>(resolve => {
    resolver = resolve;
  });
}

function accept(dontAskAgain: boolean): void {
  if (dontAskAgain) skipForSession.value = true;
  open.value = false;
  resolver?.(true);
  resolver = null;
}

function decline(): void {
  open.value = false;
  resolver?.(false);
  resolver = null;
}

/** Test-only — clears the in-memory session state. */
export function __resetThresholdForTests(): void {
  open.value = false;
  context.value = null;
  skipForSession.value = false;
  resolver?.(false);
  resolver = null;
}

export function useThresholdConfirm() {
  return {
    open,
    context,
    confirmIfNeeded,
    accept,
    decline,
  };
}
