<template>
  <Modal
    :open="open"
    size="md"
    :title="t('about.title')"
    :close-label="t('common.close')"
    @close="emit('close')"
  >
    <div class="about">
      <p class="about__intro">{{ t('about.intro') }}</p>

      <section class="about__section">
        <h3 class="about__heading">{{ t('about.nameHeading') }}</h3>
        <p>{{ t('about.nameBody') }}</p>
      </section>

      <section class="about__section">
        <h3 class="about__heading">{{ t('about.originHeading') }}</h3>
        <p>{{ t('about.originBody') }}</p>
        <p>
          <a :href="originStoryUrl" target="_blank" rel="noopener noreferrer">{{
            t('about.originLink')
          }}</a>
        </p>
      </section>

      <section class="about__section">
        <h3 class="about__heading">{{ t('about.projectHeading') }}</h3>
        <p>{{ t('about.projectBody') }}</p>
        <ul class="about__links">
          <li>
            <a :href="repoUrl" target="_blank" rel="noopener noreferrer"
              >{{ t('about.linkRepo') }} →</a
            >
          </li>
          <li>
            <a :href="driversUrl" target="_blank" rel="noopener noreferrer"
              >{{ t('about.linkDrivers') }} →</a
            >
          </li>
          <li>
            <a :href="coreUrl" target="_blank" rel="noopener noreferrer"
              >{{ t('about.linkCore') }} →</a
            >
          </li>
        </ul>
      </section>

      <section class="about__section">
        <h3 class="about__heading">{{ t('about.supportHeading') }}</h3>
        <p>{{ t('about.supportBody') }}</p>
        <div class="about__support">
          <a class="about__cta" :href="kofiUrl" target="_blank" rel="noopener noreferrer">{{
            t('about.supportKofi')
          }}</a>
          <a
            class="about__cta about__cta--ghost"
            :href="sponsorsUrl"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t('about.supportSponsors') }}</a
          >
        </div>
      </section>

      <p class="about__version">{{ t('about.version', { version }) }}</p>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();

const version = __APP_VERSION__;
const repoUrl = 'https://github.com/burnmark-io/label-maker';
const driversUrl = 'https://github.com/thermal-label';
const coreUrl = 'https://github.com/burnmark-io/designer-core';
const originStoryUrl = 'https://burnmark.io/blog/origin-story';
const kofiUrl = 'https://ko-fi.com/mannes';
const sponsorsUrl = 'https://github.com/sponsors/mannes';
</script>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--color-text);
}

.about__intro {
  font-size: var(--text-base);
  color: var(--color-text);
}

.about__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.about__heading {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.about__links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.about__support {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.about__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  font-weight: var(--weight-medium);
}

.about__cta:hover {
  background: var(--color-primary-hover);
  text-decoration: none;
}

.about__cta--ghost {
  background: transparent;
  color: var(--color-primary-text);
  border: 1px solid var(--color-border);
}

.about__cta--ghost:hover {
  background: var(--color-primary-subtle);
}

.about__version {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
