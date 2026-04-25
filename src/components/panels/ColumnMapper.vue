<template>
  <div class="mapper">
    <div class="mapper__head">
      <h3 class="mapper__title">{{ t('data.mapping.title') }}</h3>
      <p class="mapper__hint">{{ t('data.mapping.hint') }}</p>
    </div>

    <ul class="mapper__rows">
      <li v-for="placeholder in data.placeholders" :key="placeholder" class="mapper__row">
        <span class="mapper__placeholder">
          <code>{{ formatPlaceholder(placeholder) }}</code>
        </span>
        <span class="mapper__arrow" aria-hidden="true">←</span>
        <select
          :value="data.mapping[placeholder.toLowerCase()] ?? ''"
          class="mapper__select"
          :aria-label="t('data.mapping.selectFor', { placeholder })"
          @change="onChange(placeholder, $event)"
        >
          <option value="">{{ t('data.mapping.unmapped') }}</option>
          <option v-for="header in data.headers" :key="header" :value="header">
            {{ header }}
          </option>
        </select>
      </li>
    </ul>

    <div v-if="unusedColumns.length > 0" class="mapper__unused">
      <p class="mapper__unused-label">{{ t('data.mapping.unusedColumns') }}</p>
      <ul class="mapper__chips">
        <li v-for="col in unusedColumns" :key="col" class="mapper__chip">{{ col }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '@/stores/data';

const { t } = useI18n();
const data = useDataStore();

const unusedColumns = computed(() => {
  const used = new Set(Object.values(data.mapping));
  return data.headers.filter(h => !used.has(h));
});

function onChange(placeholder: string, event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  data.setColumnFor(placeholder, value || null);
}

const OPEN = '{{';
const CLOSE = '}}';
function formatPlaceholder(ph: string): string {
  return `${OPEN}${ph}${CLOSE}`;
}
</script>

<style scoped>
.mapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.mapper__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.mapper__hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.mapper__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mapper__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-bg-canvas);
  border-radius: var(--radius-sm);
}

.mapper__placeholder code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-primary-text);
  background: var(--color-primary-subtle);
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
}

.mapper__arrow {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.mapper__select {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  font-size: var(--text-xs);
  color: var(--color-text);
  width: 100%;
  min-width: 0;
}

.mapper__unused {
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}

.mapper__unused-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.mapper__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.mapper__chip {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  padding: 2px var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}
</style>
