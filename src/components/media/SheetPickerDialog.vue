<template>
  <Modal :open="open" size="md" :title="t('media.sheet.dialogTitle')" @close="emit('close')">
    <div class="sheet-picker">
      <div class="sheet-picker__filters">
        <input
          v-model="query"
          type="search"
          class="sheet-picker__search"
          :placeholder="t('media.sheet.searchPlaceholder')"
          :aria-label="t('media.sheet.searchLabel')"
        />
        <select v-model="brandFilter" class="sheet-picker__brand">
          <option value="">{{ t('media.sheet.allBrands') }}</option>
          <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
        </select>
      </div>

      <p class="sheet-picker__count">
        {{ t('media.sheet.resultCount', { count: filtered.length }) }}
      </p>

      <ul class="sheet-picker__list" role="listbox" :aria-label="t('media.sheet.listAria')">
        <li
          v-for="sheet in filtered.slice(0, 200)"
          :key="sheet.code"
          role="option"
          tabindex="0"
          class="sheet-picker__item"
          @click="onPick(sheet)"
          @keydown.enter="onPick(sheet)"
          @keydown.space.prevent="onPick(sheet)"
        >
          <p class="sheet-picker__name">{{ sheet.brand }} {{ sheet.part }}</p>
          <p class="sheet-picker__detail">
            {{ formatDetail(sheet) }}
          </p>
        </li>
      </ul>
      <p v-if="filtered.length > 200" class="sheet-picker__truncated">
        {{ t('media.sheet.truncated', { shown: 200, total: filtered.length }) }}
      </p>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { SHEETS, listBrands, type SheetTemplate } from '@burnmark-io/sheet-templates';
import Modal from '@/components/common/Modal.vue';

defineProps<{ open: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', sheet: SheetTemplate): void;
}>();

const { t } = useI18n();

const query = ref('');
const brandFilter = ref('');

const brands = computed(() => listBrands());

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return SHEETS.filter(s => {
    if (brandFilter.value && s.brand !== brandFilter.value) return false;
    if (!q) return true;
    return (
      s.brand.toLowerCase().includes(q) ||
      s.part.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );
  });
});

function formatDetail(sheet: SheetTemplate): string {
  const perPage = sheet.layouts.reduce((sum, l) => sum + l.columns * l.rows, 0);
  return t('media.sheet.detail', {
    width: sheet.labelWidthMm,
    height: sheet.labelHeightMm,
    paper: sheet.paperSize,
    perPage,
  });
}

function onPick(sheet: SheetTemplate): void {
  emit('select', sheet);
  emit('close');
}
</script>

<style scoped>
.sheet-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 300px;
  max-height: 60vh;
}

.sheet-picker__filters {
  display: flex;
  gap: var(--space-2);
}

.sheet-picker__search {
  flex: 1;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  font-size: var(--text-sm);
}

.sheet-picker__brand {
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  font-size: var(--text-sm);
}

.sheet-picker__count {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.sheet-picker__list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-canvas);
}

.sheet-picker__item {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.sheet-picker__item:last-child {
  border-bottom: none;
}

.sheet-picker__item:hover,
.sheet-picker__item:focus {
  background: var(--color-bg);
  outline: none;
}

.sheet-picker__name {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.sheet-picker__detail {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.sheet-picker__truncated {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
}
</style>
