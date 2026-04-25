<template>
  <a class="feedback-link" :href="href" target="_blank" rel="noopener noreferrer">
    {{ label }}
    <span aria-hidden="true">→</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type FeedbackKind = 'feedback' | 'translation';

const props = withDefaults(
  defineProps<{
    label: string;
    kind?: FeedbackKind;
  }>(),
  { kind: 'feedback' },
);

const FEEDBACK_URLS: Record<FeedbackKind, string> = {
  feedback: 'https://github.com/burnmark-io/label-maker/issues/new?template=feedback.yml',
  translation: 'https://github.com/burnmark-io/label-maker/issues/new?template=translation.yml',
};

const href = computed(() => FEEDBACK_URLS[props.kind]);
</script>

<style scoped>
.feedback-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-primary-text);
  font-weight: var(--weight-medium);
  text-decoration: none;
}

.feedback-link:hover {
  text-decoration: underline;
}
</style>
