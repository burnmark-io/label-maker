<template>
  <div class="app-shell">
    <TopBar @open-library="libraryOpen = true" @open-share="shareOpen = true" />
    <main class="app-shell__main">
      <section class="app-shell__canvas-area" :aria-label="t('canvas.ariaLabel')">
        <DesignCanvas />
        <MainToolbar />
        <CanvasActions
          @open-batch="batchOpen = true"
          @open-sheet="sheetOpen = true"
          @open-share="shareOpen = true"
          @open-library="libraryOpen = true"
        />
      </section>
      <SidePanel v-if="prefs.sidePanelOpen" @open-batch="batchOpen = true" />
    </main>
    <AppFooter />
    <ToastStack />
    <InstallPrompt />

    <BatchPanel :open="batchOpen" @close="batchOpen = false" />
    <SheetDialog :open="sheetOpen" @close="sheetOpen = false" />
    <DesignLibrary :open="libraryOpen" @close="libraryOpen = false" />
    <ShareDialog :open="shareOpen" @close="shareOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
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

import { useDesignerStore } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';
import { useLibraryStore } from '@/stores/library';
import { loadFirstVisitDocument } from '@/services/sample-label';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useBorderResize } from '@/composables/useBorderResize';
import { useAutoReconnect } from '@/composables/useAutoReconnect';
import { readDocumentFromHash } from '@/services/share-encoder';
import { useToast } from '@/composables/useToast';

const { t } = useI18n();
const designer = useDesignerStore();
const prefs = usePreferencesStore();
const library = useLibraryStore();
const { show } = useToast();

const batchOpen = ref(false);
const sheetOpen = ref(false);
const libraryOpen = ref(false);
const shareOpen = ref(false);

useKeyboardShortcuts();
useBorderResize();
useAutoReconnect();

onMounted(async () => {
  prefs.sessionCount += 1;
  await library.load();

  // 1. Shared design via URL hash takes top priority — explicit user action.
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    const shared = readDocumentFromHash(window.location.hash);
    if (shared) {
      designer.loadDocument(shared);
      designer.clearHistory();
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      show(t('share.imported'), 'success');
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
      return;
    }
  }

  // 3. First-visit sample label.
  if (designer.document.objects.length === 0) {
    loadFirstVisitDocument(designer);
  }
});
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
</style>
