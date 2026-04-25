<template>
  <div class="limit-banner" role="status">
    <span class="limit-banner__icon" aria-hidden="true">ℹ️</span>
    <span class="limit-banner__text">
      <slot />
    </span>
    <FeedbackLink :label="cta" :kind="kind" />
  </div>
</template>

<script setup lang="ts">
import FeedbackLink from './FeedbackLink.vue';

withDefaults(
  defineProps<{
    cta: string;
    kind?: 'feedback' | 'translation';
  }>(),
  { kind: 'feedback' },
);
</script>

<style scoped>
.limit-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-primary-subtle);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  flex-wrap: wrap;
}

.limit-banner__text {
  flex: 1;
  min-width: 200px;
  color: var(--color-text);
}

.limit-banner__icon {
  font-size: 16px;
  line-height: 1;
}
</style>
