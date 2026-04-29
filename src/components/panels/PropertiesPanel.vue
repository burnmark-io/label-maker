<template>
  <div class="properties-panel">
    <!-- No selection -->
    <p v-if="branch === 'empty'" class="panel__empty">{{ t('properties.empty') }}</p>

    <!-- Document or object — both get the sticky header -->
    <template v-else>
      <header class="properties-panel__header">
        <span class="properties-panel__header-context">{{ headerText }}</span>
        <button
          type="button"
          class="properties-panel__deselect"
          :aria-label="t('selection.deselect')"
          @click="designer.deselect()"
        >
          {{ t('selection.deselect') }}
        </button>
      </header>

      <div class="properties-panel__body">
        <DocumentProperties v-if="branch === 'document'" />
        <template v-else-if="branch === 'object' && firstObject">
          <!-- Type-specific section: leads. What is this thing? -->
          <template v-if="selectedObjects.length === 1">
            <TextProperties v-if="firstObject.type === 'text'" :object="firstObject" />
            <ImageProperties v-else-if="firstObject.type === 'image'" :object="firstObject" />
            <BarcodeProperties v-else-if="firstObject.type === 'barcode'" :object="firstObject" />
            <ShapeProperties v-else-if="firstObject.type === 'shape'" :object="firstObject" />
          </template>

          <!-- Appearance: opacity, visible, locked. Frequently adjusted. -->
          <AppearanceProperties :object="firstObject" />

          <!-- Position & Size: collapsed by default; most users drag on canvas. -->
          <CollapsibleSection
            :title="t('properties.positionAndSize')"
            :storage-key="positionStorageKey"
          >
            <CommonProperties :object="firstObject" />
          </CollapsibleSection>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore, isDocumentSelected } from '@/stores/designer';
import type { LabelObject } from '@burnmark-io/designer-core';
import CommonProperties from './CommonProperties.vue';
import TextProperties from './TextProperties.vue';
import ImageProperties from './ImageProperties.vue';
import BarcodeProperties from './BarcodeProperties.vue';
import ShapeProperties from './ShapeProperties.vue';
import DocumentProperties from './DocumentProperties.vue';
import AppearanceProperties from './AppearanceProperties.vue';
import CollapsibleSection from '@/components/common/CollapsibleSection.vue';

const { t } = useI18n();
const designer = useDesignerStore();

const branch = computed<'empty' | 'document' | 'object'>(() => {
  if (isDocumentSelected(designer.selection)) return 'document';
  if (designer.selectedObjectIds.length > 0) return 'object';
  return 'empty';
});

const selectedObjects = computed<LabelObject[]>(() => {
  const ids = new Set(designer.selectedObjectIds);
  return designer.document.objects.filter(o => ids.has(o.id));
});

const firstObject = computed<LabelObject | undefined>(() => selectedObjects.value[0]);

const positionStorageKey = computed<string>(() => {
  const t = firstObject.value?.type ?? 'object';
  return `properties.collapsible.${t}.position`;
});

const headerText = computed<string>(() => {
  if (branch.value === 'document') return t('selection.headerDocument');
  if (selectedObjects.value.length > 1) {
    return t('selection.headerMulti', { count: selectedObjects.value.length });
  }
  if (firstObject.value) {
    return firstObject.value.name ?? firstObject.value.type;
  }
  return '';
});
</script>

<style scoped>
.properties-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
}

.panel__empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.properties-panel__header {
  position: sticky;
  top: calc(var(--space-4) * -1);
  margin: calc(var(--space-4) * -1) calc(var(--space-4) * -1) 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  z-index: 1;
}

.properties-panel__header-context {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.properties-panel__deselect {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  min-height: 32px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--easing),
    color var(--duration-fast) var(--easing);
}

.properties-panel__deselect:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.properties-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-4);
}

@media (pointer: coarse) {
  .properties-panel__deselect {
    min-height: 44px;
    min-width: 44px;
    font-size: var(--text-sm);
  }
}
</style>
