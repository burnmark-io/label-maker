<template>
  <div class="objects-panel">
    <h2 class="panel__title">{{ t('panel.objects') }}</h2>
    <p v-if="!objects.length" class="panel__empty">{{ t('panel.emptyObjects') }}</p>
    <ul v-else class="objects-list" role="list">
      <li
        v-for="obj in reversed"
        :key="obj.id"
        class="objects-list__item"
        :class="{ 'objects-list__item--selected': designer.selection.includes(obj.id) }"
        @click="onClickRow(obj.id, $event)"
      >
        <span class="objects-list__icon" aria-hidden="true">{{ iconFor(obj.type) }}</span>
        <span class="objects-list__label">{{ obj.name ?? labelFor(obj.type) }}</span>
        <button
          type="button"
          class="objects-list__action"
          :aria-label="obj.visible ? t('panel.objectVisible') : t('panel.objectHidden')"
          :title="obj.visible ? t('panel.objectVisible') : t('panel.objectHidden')"
          @click.stop="toggleVisible(obj.id, !obj.visible)"
        >
          <svg v-if="obj.visible" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a17.93 17.93 0 0 1 4.06-5.94" />
            <path d="M9.9 4.24A10 10 0 0 1 12 4c7 0 11 8 11 8a17.93 17.93 0 0 1-2.51 3.39" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </button>
        <button
          type="button"
          class="objects-list__action"
          :aria-label="obj.locked ? t('panel.objectLocked') : t('panel.objectUnlocked')"
          :title="obj.locked ? t('panel.objectLocked') : t('panel.objectUnlocked')"
          @click.stop="toggleLocked(obj.id, !obj.locked)"
        >
          <svg v-if="obj.locked" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        </button>
        <button
          type="button"
          class="objects-list__action"
          :aria-label="t('topbar.undo')"
          title="Bring forward"
          @click.stop="bringForward(obj.id)"
        >
          ↑
        </button>
        <button
          type="button"
          class="objects-list__action"
          :aria-label="t('topbar.redo')"
          title="Send backward"
          @click.stop="sendBackward(obj.id)"
        >
          ↓
        </button>
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
// Top-of-list = top-of-z-order
const reversed = computed(() => [...objects.value].reverse());

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

function onClickRow(id: string, event: MouseEvent): void {
  if (event.shiftKey) {
    if (designer.selection.includes(id)) {
      designer.select(designer.selection.filter((x) => x !== id));
    } else {
      designer.select([...designer.selection, id]);
    }
  } else {
    designer.select([id]);
  }
}

function toggleVisible(id: string, visible: boolean): void {
  designer.updateObject(id, { visible });
}

function toggleLocked(id: string, locked: boolean): void {
  designer.updateObject(id, { locked });
}

function bringForward(id: string): void {
  designer.reorder(id, 'up');
}

function sendBackward(id: string): void {
  designer.reorder(id, 'down');
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
  padding: var(--space-2);
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
  flex-shrink: 0;
}

.objects-list__label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: none;
}

.objects-list__action {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  flex-shrink: 0;
}

.objects-list__action:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}
</style>
