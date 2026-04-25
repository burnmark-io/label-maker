<template>
  <div class="toasts" role="region" aria-live="polite" aria-label="Notifications">
    <transition-group name="toast" tag="div" class="toasts__list">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.kind}`"
        role="status"
      >
        <span class="toast__message">{{ toast.message }}</span>
        <button
          v-if="!toast.sticky"
          class="toast__dismiss"
          type="button"
          aria-label="Dismiss"
          @click="dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts, dismiss } = useToast();
</script>

<style scoped>
.toasts {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  z-index: 100;
  pointer-events: none;
}

.toasts__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-end;
}

.toast {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  max-width: 360px;
  font-size: var(--text-sm);
  pointer-events: auto;
}

.toast--success {
  border-left: 3px solid var(--color-success);
}

.toast--error {
  border-left: 3px solid var(--color-error);
}

.toast--info {
  border-left: 3px solid var(--color-primary);
}

.toast__message {
  flex: 1;
}

.toast__dismiss {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
}

.toast__dismiss:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
