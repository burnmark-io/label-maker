<template>
  <div v-if="family" class="media">
    <label class="media__label" :for="selectId">
      {{ t('printer.media') }}
      <span v-if="autoDetected" class="media__badge media__badge--auto">{{ t('printer.autoDetected') }}</span>
    </label>
    <select :id="selectId" v-model="selection" class="media__select">
      <option v-if="!autoDetected" value="">{{ t('printer.mediaPick') }}</option>
      <option v-for="m in options" :key="String(m.id)" :value="String(m.id)">
        {{ m.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrinterStore } from '@/stores/printer';
import { getMediaForFamily } from '@/lib/printer/registry';

const { t } = useI18n();
const printer = usePrinterStore();
const selectId = useId();

const family = computed(() => printer.family);
const options = computed(() => (family.value ? getMediaForFamily(family.value) : []));
const autoDetected = computed(() => !!printer.detectedMedia);

const selection = computed<string>({
  get(): string {
    return printer.effectiveMedia ? String(printer.effectiveMedia.id) : '';
  },
  set(value: string): void {
    if (!value) {
      printer.setSelectedMedia(null);
      return;
    }
    const next = options.value.find((m) => String(m.id) === value);
    if (next) printer.setSelectedMedia(next);
  },
});
</script>

<style scoped>
.media {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.media__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
}

.media__badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: var(--weight-medium);
}

.media__badge--auto {
  color: var(--color-success);
  border-color: rgba(22, 163, 74, 0.4);
  background: rgba(22, 163, 74, 0.08);
}

.media__select {
  padding: var(--space-2);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  color: var(--color-text);
}
</style>
