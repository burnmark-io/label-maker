<template>
  <div class="objects-panel">
    <ul class="objects-list" role="list">
      <li
        class="objects-list__item objects-list__item--document"
        :class="{ 'objects-list__item--selected': isDocSelected }"
      >
        <div
          class="objects-list__row objects-list__row--document"
          role="button"
          tabindex="0"
          :aria-pressed="isDocSelected"
          @click="onClickDocument"
          @keydown.enter.prevent="onClickDocument"
          @keydown.space.prevent="onClickDocument"
        >
          <span class="objects-list__icon" aria-hidden="true">📄</span>
          <span class="objects-list__doc-info">
            <span class="objects-list__label">{{ documentName }}</span>
            <span class="objects-list__doc-subtitle">{{ canvasSizeLabel }}</span>
          </span>
        </div>
      </li>
    </ul>

    <p v-if="!objects.length" class="panel__empty">
      {{ t('panel.emptyObjects') }}
    </p>
    <p v-if="objects.length" class="panel__hint">{{ t('panel.objectsHint') }}</p>
    <ul v-if="objects.length" class="objects-list" role="list">
      <li
        v-for="obj in reversed"
        :key="obj.id"
        class="objects-list__item"
        :class="{
          'objects-list__item--selected': designer.selection.includes(obj.id),
        }"
      >
        <div
          :ref="el => bindRow(obj.id, el as HTMLElement | null)"
          class="objects-list__row"
          role="button"
          tabindex="0"
          @click="onClickRow(obj.id, $event)"
          @keydown.enter.prevent="onClickRow(obj.id, $event as unknown as MouseEvent)"
          @keydown.space.prevent="onClickRow(obj.id, $event as unknown as MouseEvent)"
        >
          <span class="objects-list__icon" aria-hidden="true">{{ iconFor(obj.type) }}</span>
          <span class="objects-list__label">{{ obj.name ?? labelFor(obj.type) }}</span>
          <span
            v-if="oob.isOut(obj.id)"
            class="objects-list__warn"
            :title="t('canvas.outOfBoundsTooltip')"
            :aria-label="t('canvas.outOfBoundsTooltip')"
          >
            ⚠️
          </span>
          <button
            type="button"
            class="objects-list__action"
            :aria-label="obj.visible ? t('panel.objectVisible') : t('panel.objectHidden')"
            :title="obj.visible ? t('panel.objectVisible') : t('panel.objectHidden')"
            @click.stop="toggleVisible(obj.id, !obj.visible)"
          >
            <svg
              v-if="obj.visible"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a17.93 17.93 0 0 1 4.06-5.94"
              />
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
            <svg
              v-if="obj.locked"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          </button>
          <button
            type="button"
            class="objects-list__action"
            :aria-label="t('panel.bringForward')"
            :title="t('panel.bringForward')"
            @click.stop="bringForward(obj.id)"
          >
            ↑
          </button>
          <button
            type="button"
            class="objects-list__action"
            :aria-label="t('panel.sendBackward')"
            :title="t('panel.sendBackward')"
            @click.stop="sendBackward(obj.id)"
          >
            ↓
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore, DOCUMENT_SELECTION_ID, isDocumentSelected } from '@/stores/designer';
import { useOutOfBounds } from '@/composables/useOutOfBounds';
import type { LabelObject } from '@burnmark-io/designer-core';

const { t } = useI18n();
const designer = useDesignerStore();
const oob = useOutOfBounds();

const objects = computed<LabelObject[]>(() => designer.document.objects);
// Top-of-list = top-of-z-order
const reversed = computed(() => [...objects.value].reverse());

const isDocSelected = computed(() => isDocumentSelected(designer.selection));

const documentName = computed(() => designer.document.name?.trim() || t('document.untitled'));

const canvasSizeLabel = computed<string>(() => {
  const c = designer.document.canvas;
  const widthMm = (c.widthDots / c.dpi) * 25.4;
  const heightMm = c.heightDots > 0 ? (c.heightDots / c.dpi) * 25.4 : 0;
  if (heightMm === 0) return `${widthMm.toFixed(0)}mm × continuous`;
  return `${widthMm.toFixed(0)} × ${heightMm.toFixed(0)} mm`;
});

const rowEls = new Map<string, HTMLElement>();
function bindRow(id: string, el: HTMLElement | null): void {
  if (el) rowEls.set(id, el);
  else rowEls.delete(id);
}

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

function onClickRow(id: string, event: MouseEvent | KeyboardEvent): void {
  const shift = 'shiftKey' in event && event.shiftKey;
  if (shift) {
    if (designer.selection.includes(id)) {
      designer.select(designer.selection.filter(x => x !== id));
    } else {
      designer.select([...designer.selection, id]);
    }
  } else {
    designer.select([id]);
  }
}

// The document root row never participates in shift-add (mutually exclusive
// with regular object selection per amendment §6.2). Always replaces.
function onClickDocument(): void {
  designer.select([DOCUMENT_SELECTION_ID]);
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

.panel__empty {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.panel__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: -2px;
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
  border-radius: var(--radius-md);
  background: transparent;
  display: flex;
  flex-direction: column;
  transition: background var(--duration-fast) var(--easing);
}

.objects-list__item--selected {
  background: var(--color-primary-subtle);
}

.objects-list__item--document {
  background: var(--color-bg-canvas);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-2);
}

.objects-list__item--document.objects-list__item--selected {
  background: var(--color-primary-subtle);
}

.objects-list__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.objects-list__row:hover {
  background: var(--color-primary-subtle);
}

.objects-list__row--document {
  align-items: flex-start;
}

.objects-list__item--selected > .objects-list__row {
  color: var(--color-primary-text);
}

.objects-list__row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
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

.objects-list__doc-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.objects-list__doc-subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.objects-list__warn {
  font-size: 12px;
  line-height: 1;
  color: var(--color-warning, #d97706);
  flex-shrink: 0;
  cursor: help;
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
