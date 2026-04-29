<template>
  <div class="app-shell">
    <template v-if="!cryptoStore.locked">
      <TopBar @open-library="libraryOpen = true" @open-share="shareOpen = true" />
      <main class="app-shell__main">
        <section
          class="app-shell__canvas-area"
          :aria-label="t('canvas.ariaLabel')"
          data-tour="canvas"
        >
          <CanvasResizeBanner />
          <DesignCanvas />
          <span class="visually-hidden" aria-live="polite">{{ canvasSummary }}</span>
          <MainToolbar data-tour="toolbar" />
          <CanvasActions
            @open-batch="batchOpen = true"
            @open-sheet="sheetOpen = true"
            @open-share="shareOpen = true"
            @open-library="libraryOpen = true"
          />
        </section>
        <SidePanel
          data-tour="side-panel"
          @open-batch="batchOpen = true"
          @open-sheet-picker="sheetOpen = true"
        />
      </main>
      <InstallPrompt />
      <ImportDropOverlay />
      <BatchPanel :open="batchOpen" @close="batchOpen = false" />
      <SheetDialog :open="sheetOpen" @close="sheetOpen = false" />
      <SheetViewer
        :open="sheetViewer.open.value"
        :payload="sheetViewer.payload.value"
        @close="sheetViewer.close"
      />
      <DesignLibrary :open="libraryOpen" @close="libraryOpen = false" />
      <ShareDialog :open="shareOpen" @close="shareOpen = false" />
      <OnboardingTour :active="tourActive" @close="closeTour" />
    </template>
    <UnlockScreen v-else @open-reset="resetOpen = true" />

    <AppFooter />
    <ToastStack />
    <PrintProgressToast />
    <ThresholdConfirmDialog />
    <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
    <HelpDialog :open="helpOpen" @close="helpOpen = false" @restart-tour="onRestartTour" />
    <PrivacyDialog
      :open="privacyOpen"
      @close="privacyOpen = false"
      @open-reset="resetOpen = true"
    />
    <ResetDataDialog :open="resetOpen" @close="resetOpen = false" />

    <ConfirmDialog
      :open="confirmer.open.value"
      :title="confirmer.options.value?.title ?? ''"
      :message="confirmer.options.value?.message ?? ''"
      :cancel-label="confirmer.options.value?.cancelLabel ?? ''"
      v-bind="confirmDialogProps"
      @confirm="confirmer.resolve"
      @secondary="confirmer.resolveSecondary"
      @cancel="confirmer.cancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import TopBar from './TopBar.vue';
import SidePanel from './SidePanel.vue';
import AppFooter from './AppFooter.vue';
import DesignCanvas from '@/components/canvas/DesignCanvas.vue';
import CanvasResizeBanner from '@/components/canvas/CanvasResizeBanner.vue';
import MainToolbar from '@/components/toolbar/MainToolbar.vue';
import CanvasActions from '@/components/toolbar/CanvasActions.vue';
import ToastStack from '@/components/common/ToastStack.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import InstallPrompt from '@/components/common/InstallPrompt.vue';
import ImportDropOverlay from './ImportDropOverlay.vue';
import BatchPanel from '@/components/batch/BatchPanel.vue';
import SheetDialog from '@/components/sheets/SheetDialog.vue';
import SheetViewer from '@/components/sheets/SheetViewer.vue';
import PrintProgressToast from '@/components/feedback/PrintProgressToast.vue';
import ThresholdConfirmDialog from '@/components/feedback/ThresholdConfirmDialog.vue';
import { useSheetViewer } from '@/composables/useSheetViewer';
import DesignLibrary from '@/components/library/DesignLibrary.vue';
import ShareDialog from '@/components/share/ShareDialog.vue';
import AboutDialog from '@/components/common/AboutDialog.vue';
import HelpDialog from '@/components/common/HelpDialog.vue';
import OnboardingTour from '@/components/common/OnboardingTour.vue';
import PrivacyDialog from '@/components/common/PrivacyDialog.vue';
import ResetDataDialog from '@/components/common/ResetDataDialog.vue';
import UnlockScreen from '@/components/common/UnlockScreen.vue';

import { useDesignerStore } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';
import { useLibraryStore } from '@/stores/library';
import { useMediaStore } from '@/stores/media';
import { useCryptoStore } from '@/stores/crypto';
import { useDataStore } from '@/stores/data';
import { hydrateMappings } from '@/services/column-mapper';
import { loadFirstVisitDocument } from '@/services/sample-label';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useBorderResize } from '@/composables/useBorderResize';
import { useAutoReconnect } from '@/composables/useAutoReconnect';
import { usePageTitle } from '@/composables/usePageTitle';
import { useCanvasViewport, CANVAS_VIEWPORT_KEY } from '@/composables/useCanvasViewport';
import { readDocumentFromHash } from '@/services/share-encoder';
import { useLabelImport } from '@/composables/useLabelImport';
import { useToast } from '@/composables/useToast';
import { useConfirm, isChoiceOptions } from '@/composables/useConfirm';
import { useDocumentLifecycle } from '@/composables/useDocumentLifecycle';
import { useUiDialogs } from '@/composables/useUiDialogs';
import { SUPPORTED_LOCALES } from '@/i18n';

const { t } = useI18n();
const designer = useDesignerStore();
const prefs = usePreferencesStore();
const library = useLibraryStore();
const media = useMediaStore();
const cryptoStore = useCryptoStore();
const { show } = useToast();

// Out-of-bounds toast on canvas resize. Watch only canvas dimensions
// (and the user-set continuous length) — object moves shouldn't fire it.
watch(
  () => [
    designer.document.canvas.widthDots,
    designer.document.canvas.heightDots,
    media.continuousLengthMm,
  ],
  (next, prev) => {
    if (!prev) return;
    const [, prevH, prevContLen] = prev as number[];
    const [, nextH, nextContLen] = next as number[];
    // Effective height = continuousLengthMm dots when continuous, else heightDots.
    const dpi = designer.document.canvas.dpi || 300;
    const prevEff = prevH === 0 ? Math.round((prevContLen * dpi) / 25.4) : prevH;
    const nextEff = nextH === 0 ? Math.round((nextContLen * dpi) / 25.4) : nextH;
    // Only toast when the effective height shrunk (a smaller frame can push
    // objects out — a bigger frame can't).
    if (nextEff >= prevEff && next[0] >= prev[0]) return;
    let count = 0;
    for (const o of designer.document.objects) {
      if (!o.visible) continue;
      const right = o.x + o.width;
      const bottom = o.y + o.height;
      if (o.x < 0 || o.y < 0 || right > next[0] || bottom > nextEff) count += 1;
    }
    if (count > 0) {
      show(t('canvas.outOfBoundsResizeToast', { count }, count), 'info', { ttlMs: 5000 });
    }
  },
);
const labelImport = useLabelImport();
const lifecycle = useDocumentLifecycle();
const confirmer = useConfirm();
const { aboutOpen, helpOpen, privacyOpen, tourActive, openHelp, startTour, closeTour } =
  useUiDialogs();

const batchOpen = ref(false);
const sheetOpen = ref(false);
const sheetViewer = useSheetViewer();
const libraryOpen = ref(false);
const shareOpen = ref(false);
const resetOpen = ref(false);

let bootstrapped = false;

// Pass the right subset of fields to <ConfirmDialog> based on whether
// the active prompt is a binary confirm or a three-way choose. The
// dialog itself decides how many buttons to render based on which
// labels are present.
const confirmDialogProps = computed(() => {
  const opts = confirmer.options.value;
  if (!opts) return {};
  if (isChoiceOptions(opts)) {
    return {
      primaryLabel: opts.primaryLabel,
      secondaryLabel: opts.secondaryLabel,
      primaryTone: opts.primaryTone ?? 'primary',
      secondaryTone: opts.secondaryTone ?? 'primary',
    };
  }
  return {
    confirmLabel: opts.confirmLabel,
    tone: opts.tone ?? 'primary',
  };
});

const canvasSummary = computed(() => {
  const count = designer.document.objects.length;
  if (count === 0) return t('canvas.summaryEmpty');
  return t('canvas.summary', { count }, count);
});

function onRestartTour(): void {
  prefs.tourCompleted = false;
  startTour();
}

function clearHashFromUrl(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Mid-session share-link load. The boot path (`bootstrapAfterUnlock`)
// reads the hash on first unlock; this listener picks up every
// subsequent hash change — pasting a link into the address bar of an
// already-open tab, or clicking a same-origin share URL. Skips while
// locked or before bootstrap completes; the boot path will pick up the
// hash at unlock time in those cases.
async function onHashChange(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (cryptoStore.locked || !bootstrapped) return;
  if (window.location.hash.length <= 1) return;

  const shared = readDocumentFromHash(window.location.hash);
  if (!shared) {
    clearHashFromUrl();
    return;
  }

  const incomingName = shared.name || t('lifecycle.swapIncomingFallback');
  const choice = await lifecycle.confirmSwapWithSave({ incomingName });
  if (choice === 'cancel') {
    clearHashFromUrl();
    return;
  }
  if (choice === 'save') {
    const savedName = designer.document.name;
    const ok = await labelImport.saveCurrentToLibrary();
    if (!ok) return;
    show(t('lifecycle.savedThenOpening', { saved: savedName, incoming: incomingName }), 'info', {
      ttlMs: 4000,
    });
  }

  designer.loadDocument(shared);
  designer.clearHistory();
  clearHashFromUrl();
  show(t('share.imported'), 'success');
}

function onGlobalKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
      return;
    }
  }
  if (event.key === '?' || (event.shiftKey && event.key === '/')) {
    event.preventDefault();
    openHelp();
  }
}

useKeyboardShortcuts();
useBorderResize();
useAutoReconnect();
usePageTitle();

// Single viewport instance shared by DesignCanvas (binds the
// container, owns the zoom ref) and CanvasActions (renders mobile
// zoom buttons that need the same zoom state).
provide(CANVAS_VIEWPORT_KEY, useCanvasViewport());

async function bootstrapAfterUnlock(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  // Hydrate stores that were skipped at boot when the app was locked.
  // Idempotent: data store guards with bootHydrated; column-mapper does
  // the same.
  await hydrateMappings(true);
  await useDataStore().hydrate();
  await library.load();

  // 0. PWA file_handlers — if the OS routed a file open at us via launchQueue
  //    (Chromium-only), drain the queue and import the first file. Wins over
  //    the share-URL hash because it's an explicit OS-level user action.
  if (typeof window !== 'undefined' && 'launchQueue' in window) {
    type LaunchParams = { files?: FileSystemFileHandle[] };
    const queue = (
      window as unknown as {
        launchQueue: { setConsumer(cb: (p: LaunchParams) => void): void };
      }
    ).launchQueue;
    queue.setConsumer(async (params: LaunchParams) => {
      const files = params.files;
      if (!files || files.length === 0) return;
      try {
        const file = await files[0].getFile();
        await labelImport.runImport(file);
        if (window.location.pathname === '/open') {
          window.history.replaceState(null, '', '/');
        }
      } catch {
        // Swallow — the runImport flow handles its own error surfacing.
      }
    });
  }

  // 1. Shared design via URL hash takes top priority — explicit user action.
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    const shared = readDocumentFromHash(window.location.hash);
    if (shared) {
      designer.loadDocument(shared);
      designer.clearHistory();
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      show(t('share.imported'), 'success');
      maybeStartTour();
      return;
    }
  }

  // 2. Last-opened design from the library, if any.
  const lastId = library.lastOpenedId;
  if (lastId) {
    const doc = await library.loadDesign(lastId);
    if (doc) {
      designer.loadDocument(doc);
      designer.clearHistory();
      maybeStartTour();
      return;
    }
  }

  // 3. First-visit sample label.
  if (designer.document.objects.length === 0) {
    loadFirstVisitDocument(designer);
  }

  maybeStartTour();
}

onMounted(() => {
  prefs.sessionCount += 1;
  window.addEventListener('keydown', onGlobalKeyDown);
  window.addEventListener('hashchange', onHashChange);

  // Reflect the active locale on <html lang="..."> for screen readers.
  if (typeof document !== 'undefined') {
    document.documentElement.lang = prefs.locale;
  }

  // Missing-locale toast — once total, only when the browser asked for a
  // language we don't ship yet and we fell back to English.
  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language?.slice(0, 2).toLowerCase();
    const navFull = navigator.language ?? '';
    const navDisplay = navFull
      ? (new Intl.DisplayNames([navFull], { type: 'language' }).of(navFull) ?? navFull)
      : '';
    const fellBack = navLang && !SUPPORTED_LOCALES.includes(navLang as 'en' | 'nl');
    const seen = localStorage.getItem('burnmark.localeToastShown');
    if (fellBack && !seen) {
      show(t('locale.missingToast', { language: navDisplay || navFull }), 'info', { ttlMs: 7000 });
      localStorage.setItem('burnmark.localeToastShown', '1');
    }
  }

  if (!cryptoStore.locked) {
    void bootstrapAfterUnlock();
  }
});

// Run the post-unlock bootstrap when the user enters their password and
// the app transitions out of the locked state.
watch(
  () => cryptoStore.locked,
  isLocked => {
    if (!isLocked) void bootstrapAfterUnlock();
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
  window.removeEventListener('hashchange', onHashChange);
});

function maybeStartTour(): void {
  if (prefs.tourCompleted) return;
  // Wait a tick so the canvas / toolbar / panel anchors exist.
  setTimeout(() => {
    startTour();
    prefs.tourCompleted = true;
  }, 600);
}
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--color-bg);
}

.app-shell__main {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

.app-shell__canvas-area {
  flex: 1;
  overflow: hidden;
  background: var(--color-bg-canvas);
  position: relative;
  min-width: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .app-shell__main {
    flex-direction: column;
  }
}
</style>
