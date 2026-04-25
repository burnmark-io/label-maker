<template>
  <aside class="side-panel" :aria-label="t('panel.properties')">
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
        @click="prefs.sidePanelTab = tab.id"
        @keydown.right.prevent="cycle(1)"
        @keydown.left.prevent="cycle(-1)"
      >
        {{ tab.label }}
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
import { usePreferencesStore, type SidePanelTab } from '@/stores/preferences';
import ObjectsPanel from '@/components/panels/ObjectsPanel.vue';
import PropertiesPanel from '@/components/panels/PropertiesPanel.vue';
import DataPanel from '@/components/panels/DataPanel.vue';
import PrintPreview from '@/components/printer/PrintPreview.vue';

const emit = defineEmits<{
  (e: 'open-batch'): void;
}>();

const { t } = useI18n();
const prefs = usePreferencesStore();

const tabs = computed<{ id: SidePanelTab; label: string }[]>(() => [
  { id: 'objects', label: t('panel.objects') },
  { id: 'properties', label: t('panel.properties') },
  { id: 'data', label: t('panel.data') },
  { id: 'preview', label: t('panel.preview') },
]);

function cycle(delta: number): void {
  const ids = tabs.value.map(tab => tab.id);
  const idx = ids.indexOf(prefs.sidePanelTab);
  const next = (idx + delta + ids.length) % ids.length;
  prefs.sidePanelTab = ids[next];
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

.side-panel__body {
  flex: 1;
  overflow: auto;
  padding: var(--space-4);
}
</style>
