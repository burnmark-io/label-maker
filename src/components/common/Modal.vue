<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="open" class="modal" role="dialog" aria-modal="true" :aria-labelledby="titleId" @mousedown.self="onBackdrop">
        <div class="modal__panel" :class="`modal__panel--${size}`" @mousedown.stop>
          <header v-if="$slots.title || title" class="modal__header">
            <h2 :id="titleId" class="modal__title">
              <slot name="title">{{ title }}</slot>
            </h2>
            <button
              type="button"
              class="modal__close"
              :aria-label="closeLabel"
              @click="emit('close')"
            >×</button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useId, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    closeOnBackdrop?: boolean;
    closeLabel?: string;
  }>(),
  {
    size: 'md',
    closeOnBackdrop: true,
    closeLabel: 'Close',
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const titleId = useId();

function onBackdrop(): void {
  if (props.closeOnBackdrop) emit('close');
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) emit('close');
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));

watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
);
</script>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(28, 25, 23, 0.4);
  backdrop-filter: blur(2px);
}

.modal__panel {
  background: var(--color-bg-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - var(--space-8));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal__panel--sm { max-width: 400px; }
.modal__panel--md { max-width: 640px; }
.modal__panel--lg { max-width: 960px; }

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.modal__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.modal__close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 22px;
  color: var(--color-text-secondary);
  background: transparent;
  line-height: 1;
}

.modal__close:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.modal__body {
  flex: 1;
  overflow: auto;
  padding: var(--space-4);
}

.modal__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-fast) var(--easing);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal__panel,
.modal-leave-active .modal__panel {
  transition: transform var(--duration-base) var(--easing);
}

.modal-enter-from .modal__panel,
.modal-leave-to .modal__panel {
  transform: translateY(8px) scale(0.98);
}
</style>
