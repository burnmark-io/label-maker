<template>
  <form class="custom-size" @submit.prevent="onApply">
    <div class="custom-size__row">
      <label class="custom-size__field">
        <span class="custom-size__label">{{ t('media.custom.width') }}</span>
        <input
          v-model.number="width"
          type="number"
          min="1"
          step="0.1"
          class="custom-size__input"
          :aria-label="t('media.custom.width')"
        />
        <span class="custom-size__unit">mm</span>
      </label>
      <label class="custom-size__field">
        <span class="custom-size__label">{{ t('media.custom.height') }}</span>
        <input
          v-model="heightRaw"
          type="number"
          min="0"
          step="0.1"
          class="custom-size__input"
          :placeholder="t('media.custom.heightPlaceholder')"
          :aria-label="t('media.custom.height')"
        />
        <span class="custom-size__unit">mm</span>
      </label>
    </div>
    <p class="custom-size__hint">{{ t('media.custom.hint') }}</p>
    <button type="submit" class="custom-size__apply" :disabled="!canApply">
      {{ t('media.custom.apply') }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  initialWidthMm: number;
  initialHeightMm: number | null;
}>();

const emit = defineEmits<{
  (e: 'apply', widthMm: number, heightMm: number | null): void;
}>();

const { t } = useI18n();

const width = ref<number>(round1(props.initialWidthMm));
const heightRaw = ref<string>(
  props.initialHeightMm === null ? '' : String(round1(props.initialHeightMm)),
);

watch(
  () => [props.initialWidthMm, props.initialHeightMm],
  ([w, h]) => {
    width.value = round1(w as number);
    heightRaw.value = h === null ? '' : String(round1(h as number));
  },
);

const parsedHeight = computed<number | null>(() => {
  const trimmed = heightRaw.value.trim();
  if (trimmed === '' || trimmed === '0') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
});

const canApply = computed(() => Number.isFinite(width.value) && width.value > 0);

function onApply(): void {
  if (!canApply.value) return;
  emit('apply', width.value, parsedHeight.value);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
</script>

<style scoped>
.custom-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.custom-size__row {
  display: flex;
  gap: var(--space-2);
}

.custom-size__field {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}

.custom-size__label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  min-width: 38px;
}

.custom-size__input {
  flex: 1;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.custom-size__unit {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.custom-size__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.custom-size__apply {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  cursor: pointer;
}

.custom-size__apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-size__apply:not(:disabled):hover {
  background: var(--color-bg);
}
</style>
