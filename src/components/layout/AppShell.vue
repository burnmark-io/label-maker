<template>
  <div class="app-shell">
    <TopBar @open-library="libraryOpen = true" @open-share="shareOpen = true" />
    <main class="app-shell__main">
      <section
        class="app-shell__canvas-area"
        :aria-label="t('canvas.ariaLabel')"
        data-tour="canvas"
      >
        <DesignCanvas />
        <span class="visually-hidden" aria-live="polite">{{ canvasSummary }}</span>
        <div data-tour="toolbar"><MainToolbar /></div>
        <CanvasActions
          @open-batch="batchOpen = true"
          @open-sheet="sheetOpen = true"
          @open-share="shareOpen = true"
          @open-library="libraryOpen = true"
        />
      </section>
      <div v-if="prefs.sidePanelOpen" data-tour="side-panel" class="app-shell__side">
        <SidePanel @open-batch="batchOpen = true" />
      </div>
    </main>
    <AppFooter />
    <ToastStack />
    <InstallPrompt />

    <BatchPanel :open="batchOpen" @close="batchOpen = false" />
    <SheetDialog :open="sheetOpen" @close="sheetOpen = false" />
    <DesignLibrary :open="libraryOpen" @close="libraryOpen = false" />
    <ShareDialog :open="shareOpen" @close="shareOpen = false" />
    <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
    <HelpDialog :open="helpOpen" @close="helpOpen = false" @restart-tour="onRestartTour" />
    <OnboardingTour :active="tourActive" @close="closeTour" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import TopBar from './TopBar.vue';
import SidePanel from './SidePanel.vue';
import AppFooter from './AppFooter.vue';
import DesignCanvas from '@/components/canvas/DesignCanvas.vue';
import MainToolbar from '@/components/toolbar/MainToolbar.vue';
import CanvasActions from '@/components/toolbar/CanvasActions.vue';
import ToastStack from '@/components/common/ToastStack.vue';
import InstallPrompt from '@/components/common/InstallPrompt.vue';
import BatchPanel from '@/components/batch/BatchPanel.vue';
import SheetDialog from '@/components/sheets/SheetDialog.vue';
import DesignLibrary from '@/components/library/DesignLibrary.vue';
import ShareDialog from '@/components/share/ShareDialog.vue';
import AboutDialog from '@/components/common/AboutDialog.vue';
import HelpDialog from '@/components/common/HelpDialog.vue';
import OnboardingTour from '@/components/common/OnboardingTour.vue';

import { useDesignerStore } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';
import { useLibraryStore } from '@/stores/library';
import { loadFirstVisitDocument } from '@/services/sample-label';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useBorderResize } from '@/composables/useBorderResize';
import { useAutoReconnect } from '@/composables/useAutoReconnect';
import { readDocumentFromHash } from '@/services/share-encoder';
import { useToast } from '@/composables/useToast';
import { useUiDialogs } from '@/composables/useUiDialogs';
import { SUPPORTED_LOCALES } from '@/i18n';

const { t } = useI18n();
const designer = useDesignerStore();
const prefs = usePreferencesStore();
const library = useLibraryStore();
const { show } = useToast();
const { aboutOpen, helpOpen, tourActive, openHelp, startTour, closeTour } = useUiDialogs();

const batchOpen = ref(false);
const sheetOpen = ref(false);
const libraryOpen = ref(false);
const shareOpen = ref(false);

const canvasSummary = computed(() => {
  const count = designer.document.objects.length;
  if (count === 0) return t('canvas.summaryEmpty');
  return t('canvas.summary', { count }, count);
});

function onRestartTour(): void {
  prefs.tourCompleted = false;
  startTour();
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

onMounted(async () => {
  prefs.sessionCount += 1;
  window.addEventListener('keydown', onGlobalKeyDown);

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

  await library.load();

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
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
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

.app-shell__side {
  display: flex;
  flex-shrink: 0;
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

  .app-shell__side {
    border-top: 1px solid var(--color-border);
  }
}
</style>
