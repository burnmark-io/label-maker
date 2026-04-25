<template>
  <footer class="footer" role="contentinfo">
    <a
      class="footer__sponsor"
      :href="kofiUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span aria-hidden="true">🏷️</span>
      <span>{{ sponsorText }}</span>
    </a>
    <nav class="footer__nav" aria-label="footer">
      <a :href="aboutUrl">{{ t('footer.about') }}</a>
      <span aria-hidden="true">·</span>
      <a :href="helpUrl">{{ t('footer.help') }}</a>
      <span aria-hidden="true">·</span>
      <a :href="githubUrl" target="_blank" rel="noopener noreferrer">
        {{ t('footer.github') }}
      </a>
    </nav>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, tm, rt } = useI18n();

const kofiUrl = 'https://ko-fi.com/mannes';
const aboutUrl = '#about';
const helpUrl = '#help';
const githubUrl = 'https://github.com/burnmark-io/label-maker';

const sponsorText = computed(() => {
  const list = tm('footer.sponsorTexts') as unknown[];
  if (!Array.isArray(list) || list.length === 0) return '';
  const idx = Math.floor(Math.random() * list.length);
  return rt(list[idx] as string);
});
</script>

<style scoped>
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--footer-height);
  padding: 0 var(--space-4);
  background: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.footer__sponsor {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}

.footer__sponsor:hover {
  color: var(--color-primary-text);
}

.footer__nav {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.footer__nav a {
  color: var(--color-text-secondary);
}

.footer__nav a:hover {
  color: var(--color-primary-text);
}

@media (max-width: 540px) {
  .footer__sponsor span:last-child {
    display: none;
  }
}
</style>
