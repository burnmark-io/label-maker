<template>
  <div class="app-shell">
    <TopBar />
    <main class="app-shell__main">
      <section class="app-shell__canvas-area" :aria-label="t('canvas.ariaLabel')">
        <DesignCanvas />
        <MainToolbar />
        <CanvasActions />
      </section>
      <SidePanel v-if="prefs.sidePanelOpen" />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import TopBar from './TopBar.vue';
import SidePanel from './SidePanel.vue';
import AppFooter from './AppFooter.vue';
import DesignCanvas from '@/components/canvas/DesignCanvas.vue';
import MainToolbar from '@/components/toolbar/MainToolbar.vue';
import CanvasActions from '@/components/toolbar/CanvasActions.vue';

import { useDesignerStore } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';
import { loadFirstVisitDocument } from '@/services/sample-label';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useBorderResize } from '@/composables/useBorderResize';

const { t } = useI18n();
const designer = useDesignerStore();
const prefs = usePreferencesStore();

useKeyboardShortcuts();
useBorderResize();

onMounted(() => {
  prefs.sessionCount += 1;
  // Load the sample label on first visit, otherwise leave the empty doc.
  // Phase 6 will replace this with: load last opened design from IndexedDB.
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
