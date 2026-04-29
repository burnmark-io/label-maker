<template>
  <section class="collapsible" :class="{ 'collapsible--open': open }">
    <button
      type="button"
      class="collapsible__trigger"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="toggle"
    >
      <span class="collapsible__chevron" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <span class="collapsible__title">{{ title }}</span>
    </button>
    <div v-show="open" :id="bodyId" class="collapsible__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    /** localStorage key (omit to disable persistence). */
    storageKey?: string;
    /** Default state when no persisted value is found. */
    defaultOpen?: boolean;
  }>(),
  { defaultOpen: false },
);

const open = ref(props.defaultOpen);

const bodyId = computed(() => `collapsible-${Math.random().toString(36).slice(2, 10)}`);

function readStorage(): boolean | null {
  if (!props.storageKey) return null;
  try {
    const raw = window.localStorage.getItem(props.storageKey);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // private mode etc.
  }
  return null;
}

function writeStorage(value: boolean): void {
  if (!props.storageKey) return;
  try {
    window.localStorage.setItem(props.storageKey, value ? '1' : '0');
  } catch {
    // ignore
  }
}

onMounted(() => {
  const stored = readStorage();
  if (stored !== null) open.value = stored;
});

watch(open, value => writeStorage(value));

// React to a storageKey change at runtime — e.g. swapping object types
// rebinds the same component instance to a different localStorage entry.
// Re-read the stored value (or fall back to defaultOpen) so the new key's
// state isn't shadowed by the previous object's choice.
watch(
  () => props.storageKey,
  () => {
    const stored = readStorage();
    open.value = stored !== null ? stored : props.defaultOpen;
  },
);

function toggle(): void {
  open.value = !open.value;
}
</script>

<style scoped>
.collapsible {
  display: flex;
  flex-direction: column;
}

.collapsible__trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.collapsible__trigger:hover {
  color: var(--color-text);
}

.collapsible__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.collapsible__chevron {
  font-size: 10px;
  width: 12px;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.collapsible__title {
  flex: 1;
}

.collapsible__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
}
</style>
