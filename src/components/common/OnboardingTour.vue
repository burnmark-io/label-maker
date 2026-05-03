<template>
  <Teleport to="body">
    <transition name="tour">
      <div
        v-if="active"
        class="tour"
        :class="{ 'tour--no-anchor': !anchor }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="tour__backdrop" @click="skip" />
        <div
          v-if="anchor"
          class="tour__highlight"
          :style="{
            top: `${anchor.top}px`,
            left: `${anchor.left}px`,
            width: `${anchor.width}px`,
            height: `${anchor.height}px`,
          }"
        />
        <div class="tour__card" :style="cardStyle" role="document">
          <header class="tour__header">
            <span class="tour__step">{{
              t('tour.step', { current: stepIndex + 1, total: steps.length })
            }}</span>
            <button type="button" class="tour__close" :aria-label="t('common.close')" @click="skip">
              ×
            </button>
          </header>
          <h3 :id="titleId" class="tour__title">{{ t(currentStep.titleKey) }}</h3>
          <p class="tour__body">{{ t(currentStep.bodyKey) }}</p>
          <footer class="tour__footer">
            <button type="button" class="tour__btn tour__btn--ghost" @click="skip">
              {{ t('tour.skip') }}
            </button>
            <div class="tour__nav">
              <button
                v-if="stepIndex > 0"
                type="button"
                class="tour__btn tour__btn--ghost"
                @click="prev"
              >
                {{ t('tour.back') }}
              </button>
              <button
                v-if="stepIndex < steps.length - 1"
                type="button"
                class="tour__btn tour__btn--primary"
                @click="next"
              >
                {{ t('tour.next') }}
              </button>
              <button v-else type="button" class="tour__btn tour__btn--primary" @click="finish">
                {{ t('tour.done') }}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const { show } = useToast();
const titleId = useId();

interface Step {
  selector: string;
  titleKey: string;
  bodyKey: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const steps: Step[] = [
  {
    selector: '[data-tour="canvas"]',
    titleKey: 'tour.step1Title',
    bodyKey: 'tour.step1Body',
    placement: 'top',
  },
  {
    selector: '[data-tour="toolbar"]',
    titleKey: 'tour.step2Title',
    bodyKey: 'tour.step2Body',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="side-panel"]',
    titleKey: 'tour.step3Title',
    bodyKey: 'tour.step3Body',
    placement: 'left',
  },
  {
    selector: '[data-tour="output-target"]',
    titleKey: 'tour.step4Title',
    bodyKey: 'tour.step4Body',
    placement: 'bottom',
  },
];

const stepIndex = ref(0);
const currentStep = computed(() => steps[stepIndex.value]);
const anchor = ref<{ top: number; left: number; width: number; height: number } | null>(null);

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

const cardStyle = computed(() => {
  if (!anchor.value) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  const margin = 16;
  const cardWidth = 320;
  // Generous estimate — actual card height varies by translation length.
  // Used only for placement; final clamp keeps the card on-screen even if
  // the real height differs by a few px.
  const cardHeight = 220;
  const a = anchor.value;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = a.left + a.width / 2 - cardWidth / 2;
  const cy = a.top + a.height / 2 - cardHeight / 2;

  function place(p: Placement): { top: number; left: number } {
    switch (p) {
      case 'top':
        return { top: a.top - cardHeight - margin, left: cx };
      case 'bottom':
        return { top: a.top + a.height + margin, left: cx };
      case 'left':
        return { top: cy, left: a.left - cardWidth - margin };
      case 'right':
        return { top: cy, left: a.left + a.width + margin };
      default:
        return { top: cy, left: cx };
    }
  }

  function fits(pos: { top: number; left: number }): boolean {
    return (
      pos.top >= margin &&
      pos.left >= margin &&
      pos.top + cardHeight <= vh - margin &&
      pos.left + cardWidth <= vw - margin
    );
  }

  const opposite: Record<Placement, Placement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
    center: 'center',
  };

  // Preferred → opposite → centered overlay. Final clamp keeps it on-screen
  // even when the anchor itself is larger than the viewport minus margins.
  const preferred = currentStep.value.placement as Placement;
  let pos = place(preferred);
  if (!fits(pos)) pos = place(opposite[preferred]);
  if (!fits(pos)) pos = place('center');

  pos.top = Math.max(margin, Math.min(pos.top, vh - cardHeight - margin));
  pos.left = Math.max(margin, Math.min(pos.left, vw - cardWidth - margin));

  return { top: `${pos.top}px`, left: `${pos.left}px` };
});

async function refreshAnchor(): Promise<void> {
  await nextTick();
  const sel = currentStep.value.selector;
  const el = typeof document !== 'undefined' ? document.querySelector(sel) : null;
  if (!el) {
    anchor.value = null;
    return;
  }
  const rect = el.getBoundingClientRect();
  anchor.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function next(): void {
  if (stepIndex.value < steps.length - 1) {
    stepIndex.value += 1;
  }
}

function prev(): void {
  if (stepIndex.value > 0) {
    stepIndex.value -= 1;
  }
}

function skip(): void {
  emit('close');
}

function finish(): void {
  show(t('tour.completedToast'), 'success');
  emit('close');
}

function onResize(): void {
  void refreshAnchor();
}

function onKeyDown(event: KeyboardEvent): void {
  if (!props.active) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    skip();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    next();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    prev();
  }
}

watch(
  () => props.active,
  isActive => {
    if (isActive) {
      stepIndex.value = 0;
      void refreshAnchor();
      window.addEventListener('resize', onResize);
      window.addEventListener('keydown', onKeyDown);
    } else {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
    }
  },
  { immediate: true },
);

watch(stepIndex, () => {
  void refreshAnchor();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 300;
  pointer-events: none;
}

.tour__backdrop {
  position: absolute;
  inset: 0;
  /* Transparent — the highlight's outward box-shadow provides the dim, so
     we don't double up. Pointer-events stay enabled for click-to-dismiss. */
  background: transparent;
  pointer-events: auto;
}

.tour--no-anchor .tour__backdrop {
  background: rgba(28, 25, 23, 0.45);
}

.tour__highlight {
  position: absolute;
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 9999px rgba(28, 25, 23, 0.45);
  pointer-events: none;
  transition:
    top var(--duration-base) var(--easing),
    left var(--duration-base) var(--easing),
    width var(--duration-base) var(--easing),
    height var(--duration-base) var(--easing);
}

.tour__card {
  position: absolute;
  width: 320px;
  pointer-events: auto;
  background: var(--color-bg-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition:
    top var(--duration-base) var(--easing),
    left var(--duration-base) var(--easing);
}

.tour__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tour__step {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tour__close {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-secondary);
}

.tour__close:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.tour__title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.tour__body {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.tour__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.tour__nav {
  display: inline-flex;
  gap: var(--space-2);
}

.tour__btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid transparent;
}

.tour__btn--ghost {
  color: var(--color-text-secondary);
  background: transparent;
}

.tour__btn--ghost:hover {
  background: var(--color-bg-canvas);
  color: var(--color-text);
}

.tour__btn--primary {
  background: var(--color-primary);
  color: white;
}

.tour__btn--primary:hover {
  background: var(--color-primary-hover);
}

.tour-enter-active,
.tour-leave-active {
  transition: opacity var(--duration-fast) var(--easing);
}

.tour-enter-from,
.tour-leave-to {
  opacity: 0;
}
</style>
