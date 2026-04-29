<template>
  <transition name="banner-fade">
    <div
      v-if="banner.mode === 'adopt' && banner.payload"
      class="banner banner--adopt"
      role="status"
    >
      <span class="banner__message">
        {{
          t('banner.adopt.title', {
            media: banner.payload.media.name,
            printer: banner.payload.printerName,
          })
        }}
      </span>
      <div class="banner__actions">
        <button class="banner__btn banner__btn--primary" type="button" @click="onUse">
          {{ t('banner.adopt.useThisSize') }}
        </button>
        <button
          class="banner__btn banner__btn--icon"
          type="button"
          :aria-label="t('banner.dismiss')"
          @click="banner.hide"
        >
          ✕
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useResizeBannerStore } from '@/stores/resizeBanner';
import { useMediaStore } from '@/stores/media';

const { t } = useI18n();
const banner = useResizeBannerStore();
const media = useMediaStore();

function onUse(): void {
  if (banner.payload) {
    media.pickDetected(banner.payload.media);
  }
  banner.hide();
}
</script>

<style scoped>
.banner {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  font-size: var(--text-sm);
  color: var(--color-text);
  margin: var(--space-2) auto;
  max-width: min(640px, calc(100% - var(--space-4)));
}

.banner--adopt {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-panel));
}

.banner__message {
  flex: 1;
  min-width: 0;
}

.banner__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.banner__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.banner__btn--primary {
  background: var(--color-primary);
  color: white;
}

.banner__btn--primary:hover {
  background: var(--color-primary-hover);
}

.banner__btn--icon {
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--color-text-muted);
}

.banner__btn--icon:hover {
  color: var(--color-text);
  background: var(--color-bg-canvas);
}

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
