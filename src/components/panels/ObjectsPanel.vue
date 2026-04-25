<template>
  <div class="objects-panel">
    <h2 class="panel__title">{{ t('panel.objects') }}</h2>
    <p v-if="!objects.length" class="panel__empty">{{ t('panel.emptyObjects') }}</p>
    <ul v-else class="objects-list" role="list">
      <li
        v-for="obj in objects"
        :key="obj.id"
        class="objects-list__item"
        :class="{ 'objects-list__item--selected': designer.selection.includes(obj.id) }"
        @click="designer.select([obj.id])"
      >
        <span class="objects-list__icon" aria-hidden="true">{{ iconFor(obj.type) }}</span>
        <span class="objects-list__label">{{ obj.name ?? labelFor(obj.type) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import type { LabelObject } from '@burnmark-io/designer-core';

const { t } = useI18n();
const designer = useDesignerStore();

const objects = computed<LabelObject[]>(() => designer.document.objects);

function iconFor(type: LabelObject['type']): string {
  switch (type) {
    case 'text':
      return 'T';
    case 'image':
      return '🖼';
    case 'barcode':
      return '▦';
    case 'shape':
      return '▢';
    case 'group':
      return '⬚';
    default:
      return '·';
  }
}

function labelFor(type: LabelObject['type']): string {
  return type;
}
</script>

<style scoped>
.objects-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel__empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.objects-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.objects-list__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-text);
  transition: background var(--duration-fast) var(--easing);
}

.objects-list__item:hover {
  background: var(--color-bg-canvas);
}

.objects-list__item--selected {
  background: var(--color-primary-light);
  color: var(--color-primary-text);
}

.objects-list__icon {
  width: 20px;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: var(--weight-semibold);
}

.objects-list__label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
