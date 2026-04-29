<template>
  <aside
    class="side-panel"
    :class="{ 'side-panel--collapsed': !prefs.sidePanelOpen }"
    :aria-label="t('panel.properties')"
  >
    <button
      class="side-panel__handle"
      type="button"
      :aria-expanded="prefs.sidePanelOpen"
      :aria-label="prefs.sidePanelOpen ? t('panel.collapse') : t('panel.expand')"
      :title="prefs.sidePanelOpen ? t('panel.collapse') : t('panel.expand')"
      @click="prefs.sidePanelOpen = !prefs.sidePanelOpen"
    >
      <span class="side-panel__handle-grip" aria-hidden="true" />
    </button>
    <div role="tablist" class="side-panel__tabs">
      <button
        v-for="tab in tabs"
        :id="`side-tab-${tab.id}`"
        :key="tab.id"
        role="tab"
        :aria-selected="prefs.sidePanelTab === tab.id"
        :aria-controls="`side-panel-${tab.id}`"
        :tabindex="prefs.sidePanelTab === tab.id ? 0 : -1"
        type="button"
        class="side-panel__tab"
        :class="{ 'side-panel__tab--active': prefs.sidePanelTab === tab.id }"
        @click="onTabClick(tab.id)"
        @keydown.right.prevent="cycle(1)"
        @keydown.left.prevent="cycle(-1)"
      >
        <span class="side-panel__tab-label">{{ tab.label }}</span>
        <span
          v-if="tab.id === 'properties' && selectionBadgeCount > 0"
          class="side-panel__tab-badge"
          :aria-label="t('panel.selectionBadge', { count: selectionBadgeCount })"
        >
          {{ selectionBadgeCount }}
        </span>
      </button>
    </div>

    <div
      :id="`side-panel-${prefs.sidePanelTab}`"
      role="tabpanel"
      :aria-labelledby="`side-tab-${prefs.sidePanelTab}`"
      class="side-panel__body"
    >
      <ObjectsPanel v-if="prefs.sidePanelTab === 'objects'" />
      <PropertiesPanel v-else-if="prefs.sidePanelTab === 'properties'" />
      <DataPanel v-else-if="prefs.sidePanelTab === 'data'" @open-batch="emit('open-batch')" />
      <PrintPreview v-else-if="prefs.sidePanelTab === 'preview'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMediaQuery } from '@vueuse/core';
import { usePreferencesStore, type SidePanelTab } from '@/stores/preferences';
import { useDesignerStore, isDocumentSelected } from '@/stores/designer';
import { useTabAutoSwitch } from '@/composables/useTabAutoSwitch';
import ObjectsPanel from '@/components/panels/ObjectsPanel.vue';
import PropertiesPanel from '@/components/panels/PropertiesPanel.vue';
import DataPanel from '@/components/panels/DataPanel.vue';
import PrintPreview from '@/components/printer/PrintPreview.vue';

const emit = defineEmits<{
  (e: 'open-batch'): void;
}>();

const { t } = useI18n();
const prefs = usePreferencesStore();
const designer = useDesignerStore();

// Mobile breakpoint matches the existing `@media (max-width: 900px)` rules
// in this file. The collapse/expand drawer behaviour only meaningfully
// applies below this width.
const isMobile = useMediaQuery('(max-width: 900px)');

useTabAutoSwitch();

const tabs = computed<{ id: SidePanelTab; label: string }[]>(() => [
  { id: 'objects', label: t('panel.objects') },
  { id: 'properties', label: t('panel.properties') },
  { id: 'data', label: t('panel.data') },
  { id: 'preview', label: t('panel.preview') },
]);

// Document selection contributes 0 to the badge count — it's a single
// "you're editing the document" state, not a count of selected items.
// Multi-object selections show their length.
const selectionBadgeCount = computed<number>(() => {
  if (isDocumentSelected(designer.selection)) return 0;
  return designer.selectedObjectIds.length;
});

function cycle(delta: number): void {
  const ids = tabs.value.map(tab => tab.id);
  const idx = ids.indexOf(prefs.sidePanelTab);
  const next = (idx + delta + ids.length) % ids.length;
  prefs.sidePanelTab = ids[next];
}

/**
 * Mobile drawer gestures (per amendment §7.3):
 *   - Tap inactive tab while collapsed → expand + switch
 *   - Tap active tab while expanded    → collapse
 *   - Tap inactive tab while expanded  → switch (drawer stays open)
 *   - Tap active tab while collapsed   → expand (no tab change)
 *
 * Collapse-on-active-tap only fires on mobile — on desktop the panel
 * is a fixed rail with no collapse affordance, so the gesture has no
 * meaning there and clicking the active tab is a no-op (matches the
 * old behaviour).
 */
function onTabClick(id: SidePanelTab): void {
  const wasActive = prefs.sidePanelTab === id;
  if (isMobile.value && !prefs.sidePanelOpen) {
    prefs.sidePanelOpen = true;
    if (!wasActive) prefs.sidePanelTab = id;
    return;
  }
  if (isMobile.value && wasActive) {
    prefs.sidePanelOpen = false;
    return;
  }
  prefs.sidePanelTab = id;
}
</script>

<style scoped>
.side-panel {
  width: var(--side-panel-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  border-left: 1px solid var(--color-border);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.side-panel__tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.side-panel__tab {
  flex: 1;
  padding: var(--space-3) var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  transition:
    color var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing);
}

.side-panel__tab:hover {
  color: var(--color-text);
}

.side-panel__tab--active {
  color: var(--color-primary-text);
  border-bottom-color: var(--color-primary);
}

.side-panel__tab-label {
  white-space: nowrap;
}

.side-panel__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-size: 11px;
  font-weight: var(--weight-semibold);
  line-height: 1;
  flex-shrink: 0;
}

.side-panel__body {
  flex: 1;
  overflow: auto;
  padding: var(--space-4);
}

.side-panel__handle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: var(--space-2);
  background: var(--color-bg-panel);
  border: none;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.side-panel__handle:hover {
  background: var(--color-bg-canvas);
}

.side-panel__handle-grip {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-border);
}

@media (max-width: 900px) {
  .side-panel__handle {
    display: inline-flex;
  }
  /* Tab bar stays visible in collapsed state — it's the discovery surface
     (amendment §7.2). Only the body region collapses. */
  .side-panel--collapsed .side-panel__body {
    display: none;
  }
  .side-panel--collapsed .side-panel__tabs {
    border-bottom: none;
  }
}

/* Full-viewport drawer at narrow viewports — flush edges so it reads as
   the primary surface, not a floating sheet (amendment §7.1). Driven by
   viewport width alone, not `(pointer: coarse)`: Firefox's responsive
   mode doesn't report `pointer: coarse` while Chrome's does, so a
   combined query left the drawer floating in Firefox even at
   phone-sized widths. Tablet portrait (768–900px) keeps the inset. */
@media (max-width: 768px) {
  .side-panel {
    width: 100vw;
    border-left: none;
    border-radius: 0;
  }
}

/* Touch-target sizing for the tabs is correctly gated to actual touch
   devices — desktop users with a narrow window don't need the bulk. */
@media (pointer: coarse) {
  .side-panel__tab {
    /* 44px hit target + padding; amendment §7.4. */
    min-height: 56px;
  }
}
</style>
