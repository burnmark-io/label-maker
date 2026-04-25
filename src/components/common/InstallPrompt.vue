<template>
  <transition name="install-prompt">
    <div v-if="visible" class="install-prompt" role="dialog" :aria-label="t('install.title')">
      <span class="install-prompt__message">{{ t('install.message') }}</span>
      <div class="install-prompt__actions">
        <button type="button" class="install-prompt__btn install-prompt__btn--ghost" @click="dismiss">
          {{ t('install.later') }}
        </button>
        <button type="button" class="install-prompt__btn install-prompt__btn--primary" @click="install">
          {{ t('install.install') }}
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useInstallPrompt } from '@/composables/useInstallPrompt';

const { t } = useI18n();
const { visible, install, dismiss } = useInstallPrompt();
</script>

<style scoped>
.install-prompt {
  position: fixed;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  max-width: calc(100vw - var(--space-8));
}

.install-prompt__message {
  flex: 1;
}

.install-prompt__actions {
  display: inline-flex;
  gap: var(--space-2);
}

.install-prompt__btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: var(--text-sm);
  cursor: pointer;
}

.install-prompt__btn--ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.install-prompt__btn--ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-canvas);
}

.install-prompt__btn--primary {
  background: var(--color-primary);
  color: white;
}

.install-prompt__btn--primary:hover {
  background: var(--color-primary-hover);
}

.install-prompt-enter-active,
.install-prompt-leave-active {
  transition: opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.install-prompt-enter-from,
.install-prompt-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
