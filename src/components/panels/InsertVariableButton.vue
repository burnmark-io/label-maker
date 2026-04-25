<template>
  <div ref="rootRef" class="insvar" :class="{ 'insvar--open': open }">
    <button
      type="button"
      class="insvar__trigger"
      :aria-label="ariaLabel"
      :title="triggerTitle"
      :aria-haspopup="true"
      :aria-expanded="open"
      :disabled="placeholders.length === 0"
      @click="onToggle"
    >
      <span aria-hidden="true">{ }</span>
    </button>
    <div v-if="open" ref="menuRef" class="insvar__menu" role="menu">
      <p class="insvar__heading">{{ t('properties.barcode.insertVariableHeading') }}</p>
      <ul class="insvar__list">
        <li v-for="ph in placeholders" :key="ph">
          <button type="button" role="menuitem" class="insvar__item" @click="onPick(ph)">
            <span class="insvar__item-token">{{ tokenLabel(ph) }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  placeholders: string[];
  ariaLabel?: string;
}>();
const emit = defineEmits<{ (e: 'insert', name: string): void }>();
const { t } = useI18n();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

const triggerTitle = computed(() =>
  props.placeholders.length === 0
    ? t('properties.barcode.noPlaceholders', { token: '{{token}}' })
    : (props.ariaLabel ?? t('properties.barcode.insertVariable')),
);

function tokenLabel(name: string): string {
  return `{{${name}}}`;
}

async function onToggle(): Promise<void> {
  if (props.placeholders.length === 0) return;
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    const first = menuRef.value?.querySelector<HTMLButtonElement>('.insvar__item');
    first?.focus();
  }
}

function close(returnFocus: boolean): void {
  open.value = false;
  if (returnFocus) {
    const trigger = rootRef.value?.querySelector<HTMLButtonElement>('.insvar__trigger');
    trigger?.focus();
  }
}

function onPick(name: string): void {
  emit('insert', name);
  close(true);
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && !root.contains(event.target as Node)) close(false);
}

function onKey(event: KeyboardEvent): void {
  if (!open.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const items = Array.from(
      menuRef.value?.querySelectorAll<HTMLButtonElement>('.insvar__item') ?? [],
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const currentIdx = items.findIndex(el => el === active);
    const nextIdx =
      event.key === 'ArrowDown'
        ? (currentIdx + 1 + items.length) % items.length
        : (currentIdx - 1 + items.length) % items.length;
    items[nextIdx]?.focus();
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick);
  document.removeEventListener('keydown', onKey);
});
</script>

<style scoped>
.insvar {
  position: relative;
  display: inline-flex;
}

.insvar__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  font-family: var(--font-mono, monospace);
  text-transform: none;
  letter-spacing: 0;
  transition:
    background var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing),
    color var(--duration-fast) var(--easing);
}

.insvar__trigger:hover:not(:disabled) {
  background: var(--color-primary-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}

.insvar__trigger:disabled {
  color: var(--color-text-muted);
  background: var(--color-bg-canvas);
  cursor: not-allowed;
  opacity: 0.7;
}

.insvar__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 50;
  min-width: 180px;
  max-height: 240px;
  overflow: auto;
  padding: var(--space-1);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.insvar__heading {
  margin: 0 0 4px;
  padding: 4px 8px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.insvar__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.insvar__item {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  text-align: left;
  font-size: var(--text-sm);
  font-family: var(--font-mono, monospace);
  text-transform: none;
  letter-spacing: 0;
}

.insvar__item:hover,
.insvar__item:focus-visible {
  background: var(--color-bg-canvas);
  outline: none;
}

.insvar__item-token {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
