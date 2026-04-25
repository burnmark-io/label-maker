<template>
  <div class="actions">
    <button class="actions__btn actions__btn--primary" type="button" @click="onPrint">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      {{ t('topbar.print') }}
    </button>

    <div class="actions__save">
      <button class="actions__btn" type="button" @click="onSave">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        {{ t('topbar.save') }}
      </button>
      <button
        class="actions__btn actions__btn--caret"
        type="button"
        :aria-label="t('actions.saveOptions')"
        @click="dropdownOpen = !dropdownOpen"
      >
        <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" aria-hidden="true">
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>
      <ul v-if="dropdownOpen" class="actions__dropdown" role="menu" @click="dropdownOpen = false">
        <li><button type="button" role="menuitem" @click="placeholder('save')">{{ t('actions.saveCurrent') }}</button></li>
        <li class="actions__divider" aria-hidden="true" />
        <li><button type="button" role="menuitem" @click="placeholder('pdf')">{{ t('actions.exportPdf') }}</button></li>
        <li><button type="button" role="menuitem" @click="placeholder('png')">{{ t('actions.exportPng') }}</button></li>
        <li><button type="button" role="menuitem" @click="placeholder('label')">{{ t('actions.exportLabel') }}</button></li>
        <li><button type="button" role="menuitem" @click="placeholder('zip')">{{ t('actions.exportZip') }}</button></li>
        <li class="actions__divider" aria-hidden="true" />
        <li><button type="button" role="menuitem" @click="placeholder('sheet')">{{ t('actions.printSheet') }}</button></li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const dropdownOpen = ref(false);

/**
 * Print and Save actions. Placement matches ADR-001 (buttons live near
 * the label, not in the topbar). Wiring lands in Phase 4 (Print) and
 * Phase 6 (Save dropdown / sheet PDF). Until then these are placeholders
 * so the layout philosophy is in place.
 */
function onPrint(): void {
  placeholder('print');
}

function onSave(): void {
  placeholder('save');
}

function placeholder(key: string): void {
  console.warn(`[burnmark] action "${key}" — wired in a later phase`);
}
</script>

<style scoped>
.actions {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 5;
}

.actions__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  border: 1px solid transparent;
  background: transparent;
  transition:
    background var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing);
}

.actions__btn:hover {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
}

.actions__btn--primary {
  background: var(--color-primary);
  color: white;
}

.actions__btn--primary:hover {
  background: var(--color-primary-hover);
  border-color: transparent;
}

.actions__save {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--radius-md);
  overflow: visible;
}

.actions__btn--caret {
  padding: 0 var(--space-2);
  margin-left: -2px;
  color: var(--color-text-secondary);
}

.actions__dropdown {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  list-style: none;
  margin: 0;
  padding: var(--space-1);
  min-width: 220px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.actions__dropdown li {
  display: block;
}

.actions__dropdown button {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.actions__dropdown button:hover {
  background: var(--color-bg-canvas);
}

.actions__divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) 0;
}
</style>
