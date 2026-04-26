<template>
  <footer class="footer" role="contentinfo">
    <span class="footer__spacer" aria-hidden="true" />
    <a class="footer__sponsor" :href="kofiUrl" target="_blank" rel="noopener noreferrer">
      <span aria-hidden="true">🏷️</span>
      <span>{{ sponsorText }}</span>
    </a>
    <nav class="footer__nav" :aria-label="t('footer.about')">
      <button type="button" class="footer__link" @click="openAbout">{{ t('footer.about') }}</button>
      <span aria-hidden="true">·</span>
      <button type="button" class="footer__link" @click="openHelp">{{ t('footer.help') }}</button>
      <span aria-hidden="true">·</span>
      <button type="button" class="footer__link" @click="openPrivacy">
        {{ t('footer.privacy') }}
      </button>
      <span aria-hidden="true">·</span>
      <a :href="githubUrl" target="_blank" rel="noopener noreferrer">
        {{ t('footer.github') }}
      </a>
    </nav>
  </footer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUiDialogs } from '@/composables/useUiDialogs';

const { t, tm, rt, locale } = useI18n();
const { openAbout, openHelp, openPrivacy } = useUiDialogs();

const kofiUrl = 'https://ko-fi.com/mannes';
const githubUrl = 'https://github.com/burnmark-io/label-maker';

// Pick once per mount; recompute when the locale switches.
const sponsorIndex = ref(0);
function pickIndex(): void {
  const list = tm('footer.sponsorTexts') as unknown[];
  if (!Array.isArray(list) || list.length === 0) {
    sponsorIndex.value = 0;
    return;
  }
  sponsorIndex.value = Math.floor(Math.random() * list.length);
}

onMounted(pickIndex);

const sponsorText = computed(() => {
  // touch the locale ref so the computed re-evaluates on language switch
  void locale.value;
  const list = tm('footer.sponsorTexts') as unknown[];
  if (!Array.isArray(list) || list.length === 0) return '';
  const idx = sponsorIndex.value % list.length;
  return rt(list[idx] as string);
});
</script>

<style scoped>
.footer {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
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
  justify-self: center;
}

.footer__sponsor:hover {
  color: var(--color-primary-text);
}

.footer__nav {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: end;
}

.footer__nav a,
.footer__link {
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.footer__nav a:hover,
.footer__link:hover {
  color: var(--color-primary-text);
  text-decoration: underline;
}

@media (max-width: 540px) {
  .footer__sponsor span:last-child {
    display: none;
  }
}
</style>
