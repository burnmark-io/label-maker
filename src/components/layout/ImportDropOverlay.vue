<template>
  <div
    v-if="active"
    class="drop-overlay"
    role="presentation"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <div class="drop-overlay__card">
      <span class="drop-overlay__icon" aria-hidden="true">⤓</span>
      <p class="drop-overlay__title">{{ t('import.dropOverlayTitle') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLabelImport } from '@/composables/useLabelImport';

const { t } = useI18n();
const labelImport = useLabelImport();

const active = ref(false);
let depth = 0;

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  // DataTransferItemList provides only an iterator-like 'contains' equivalent
  // via Array conversion; modern browsers expose `types` as DOMStringList or
  // ReadonlyArray<string>. Both spread reliably.
  return Array.from(types).includes('Files');
}

function onDragEnter(event: DragEvent): void {
  if (!hasFiles(event)) return;
  depth += 1;
  active.value = true;
}

function onDragLeave(event: DragEvent): void {
  if (!hasFiles(event)) return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) active.value = false;
}

function onDragOver(event: DragEvent): void {
  if (!hasFiles(event)) return;
  // Required so drop fires.
  event.preventDefault();
}

function onWindowDrop(event: DragEvent): void {
  // Reset on any drop that bubbles up.
  depth = 0;
  active.value = false;
  // The actual drop handling is on the overlay's @drop. This handler covers
  // edge cases where the drop happens off the overlay; without it the entry
  // counter could lock at >0.
  if (event.dataTransfer && event.dataTransfer.types) {
    // No-op; preventing default here would block CSV dropzone & friends.
  }
}

async function onDrop(event: DragEvent): Promise<void> {
  depth = 0;
  active.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  await labelImport.runImport(file);
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onWindowDrop);
});

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter);
  window.removeEventListener('dragleave', onDragLeave);
  window.removeEventListener('dragover', onDragOver);
  window.removeEventListener('drop', onWindowDrop);
});
</script>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  animation: drop-overlay-fade var(--duration-fast) var(--easing);
}

.drop-overlay__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  background: var(--color-bg-panel);
  border: 2px dashed var(--color-primary);
  border-radius: var(--radius-lg);
  color: var(--color-text);
  box-shadow: var(--shadow-lg);
}

.drop-overlay__icon {
  font-size: 48px;
  line-height: 1;
  color: var(--color-primary);
}

.drop-overlay__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  margin: 0;
  text-align: center;
}

@keyframes drop-overlay-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drop-overlay {
    animation: none;
  }
}
</style>
