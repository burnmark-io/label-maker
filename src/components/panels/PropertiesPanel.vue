<template>
  <div class="properties-panel">
    <!-- No selection -->
    <p v-if="branch === 'empty'" class="panel__empty">{{ t('properties.empty') }}</p>

    <!-- Document or object — both get the sticky header -->
    <template v-else>
      <header class="properties-panel__header">
        <template v-if="renameTarget && !renaming">
          <span
            class="properties-panel__header-context"
            :class="{ 'properties-panel__header-context--auto': !renameTarget.name }"
          >
            {{ renameTarget.name || renameTarget.placeholder }}
          </span>
          <button
            type="button"
            class="properties-panel__rename-btn"
            :aria-label="t('selection.rename')"
            :title="t('selection.rename')"
            @click="startRename"
          >
            <span aria-hidden="true">✎</span>
          </button>
        </template>
        <template v-else-if="renameTarget && renaming">
          <input
            ref="renameInputRef"
            v-model="renameDraft"
            type="text"
            class="properties-panel__rename-input"
            :aria-label="t('selection.rename')"
            :placeholder="renameTarget.placeholder"
            @keydown.enter.prevent="commitRename"
            @keydown.escape.prevent="cancelRename"
            @blur="commitRename"
          />
          <button
            type="button"
            class="properties-panel__rename-confirm"
            :aria-label="t('selection.confirmRename')"
            :title="t('selection.confirmRename')"
            @mousedown.prevent
            @click="commitRename"
          >
            <span aria-hidden="true">✓</span>
          </button>
        </template>
        <span v-else class="properties-panel__header-context">{{ headerText }}</span>
        <button
          v-if="!renaming"
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

          <!-- Appearance: opacity, visible, locked. Apply-to-all makes
               sense for these (e.g. "set all to 50% opacity"). -->
          <AppearanceProperties :objects="selectedObjects" />

          <!-- Position & Size: per-object only. Forcing two objects to the
               same X/Y stacks them; same W/H rarely matches intent. Hide
               on multi-select. -->
          <CollapsibleSection
            v-if="selectedObjects.length === 1"
            :title="t('properties.positionAndSize')"
            :storage-key="positionStorageKey"
          >
            <CommonProperties :object="firstObject" />
          </CollapsibleSection>

          <button
            type="button"
            class="properties-panel__delete"
            :title="deleteTitle"
            @click="onDeleteClick"
          >
            <svg
              class="properties-panel__delete-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            <span class="properties-panel__delete-label">{{ deleteLabel }}</span>
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
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
import { useObjectActions } from '@/composables/useObjectActions';

const MAX_NAME_LENGTH = 80;
const DELETE_LABEL_NAME_LIMIT = 30;

const { t } = useI18n();
const designer = useDesignerStore();
const { deleteSelection } = useObjectActions();

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

// Single-object selection is renameable. Document and multi-select show
// a static header — neither has a single name to edit (document name lives
// in DocumentProperties; a multi-select rename would be ambiguous).
const renameTarget = computed<{ name: string; placeholder: string } | null>(() => {
  if (branch.value !== 'object') return null;
  if (selectedObjects.value.length !== 1) return null;
  const obj = firstObject.value;
  if (!obj) return null;
  return { name: obj.name ?? '', placeholder: obj.type };
});

function renameSelected(next: string): void {
  const obj = firstObject.value;
  if (!obj) return;
  const trimmed = next.trim();
  if (!trimmed) return;
  designer.updateObject(obj.id, { name: trimmed.slice(0, MAX_NAME_LENGTH) });
}

// Rename mode for the Properties header. The [✎] button enters
// rename mode; Enter / blur / [✓] commit; Escape cancels. Escape
// flips `renaming` to false before the resulting blur fires, so the
// blur's commit early-returns via the `renaming` guard.
const renaming = ref(false);
const renameDraft = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

function startRename(): void {
  if (!renameTarget.value) return;
  renameDraft.value = renameTarget.value.name ?? '';
  renaming.value = true;
  void nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

function commitRename(): void {
  if (!renaming.value) return;
  renaming.value = false;
  renameSelected(renameDraft.value);
}

function cancelRename(): void {
  renaming.value = false;
}

// Selecting a different object (or losing the single-object target
// entirely) drops out of rename mode. The unmounted input/button
// pair handles its own cleanup.
watch(renameTarget, () => {
  renaming.value = false;
});

// Single-object label truncates the name at ~30 chars so the button
// doesn't balloon for objects with long auto-names; the full name lands
// in the title attribute. See amendment §5.6.
const deleteSingleName = computed<string>(() => {
  const obj = firstObject.value;
  if (!obj) return '';
  return obj.name?.trim() || obj.type;
});

const deleteLabel = computed<string>(() => {
  if (selectedObjects.value.length > 1) {
    return t('properties.delete.multi', { n: selectedObjects.value.length });
  }
  const name = deleteSingleName.value;
  const display =
    name.length > DELETE_LABEL_NAME_LIMIT ? `${name.slice(0, DELETE_LABEL_NAME_LIMIT)}…` : name;
  return t('properties.delete.single', { name: display });
});

const deleteTitle = computed<string | undefined>(() => {
  if (selectedObjects.value.length !== 1) return undefined;
  const name = deleteSingleName.value;
  if (name.length <= DELETE_LABEL_NAME_LIMIT) return undefined;
  return t('properties.delete.tooltipFullName', { name });
});

function onDeleteClick(): void {
  deleteSelection();
}
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

.properties-panel__header-context--auto {
  color: var(--color-text-muted);
  font-style: italic;
}

.properties-panel__rename-btn,
.properties-panel__rename-confirm {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--easing),
    color var(--duration-fast) var(--easing);
}

.properties-panel__rename-btn:hover,
.properties-panel__rename-confirm:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.properties-panel__rename-btn:focus-visible,
.properties-panel__rename-confirm:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.properties-panel__rename-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
}

.properties-panel__rename-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

@media (pointer: coarse) {
  .properties-panel__rename-btn,
  .properties-panel__rename-confirm {
    width: 36px;
    height: 36px;
  }
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

.properties-panel__delete {
  align-self: stretch;
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  background: var(--color-error);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: center;
  cursor: pointer;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition:
    background var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing),
    box-shadow var(--duration-fast) var(--easing);
}

.properties-panel__delete-icon {
  flex: 0 0 auto;
}

.properties-panel__delete-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.properties-panel__delete:hover {
  background: color-mix(in srgb, var(--color-error) 88%, black);
  border-color: color-mix(in srgb, var(--color-error) 88%, black);
}

.properties-panel__delete:focus-visible {
  outline: 2px solid var(--color-error);
  outline-offset: 2px;
}

@media (pointer: coarse) {
  .properties-panel__deselect {
    min-height: 44px;
    min-width: 44px;
    font-size: var(--text-sm);
  }

  .properties-panel__delete {
    min-height: 48px;
    font-size: var(--text-base);
  }
}
</style>
