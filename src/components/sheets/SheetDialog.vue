<template>
  <Modal :open="open" size="lg" :title="t('sheet.title')" @close="emit('close')">
    <div class="sheet-dialog">
      <p v-if="loading" class="sheet-dialog__status">{{ t('sheet.loading') }}</p>

      <template v-else>
        <div class="sheet-dialog__filters">
          <input
            v-model="query"
            type="search"
            class="sheet-dialog__search"
            :placeholder="t('sheet.searchPlaceholder')"
            :aria-label="t('sheet.searchLabel')"
          />
          <select v-model="brandFilter" class="sheet-dialog__brand">
            <option value="">{{ t('sheet.allBrands') }}</option>
            <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
          </select>
        </div>

        <p class="sheet-dialog__count">
          {{ t('sheet.resultCount', { count: filteredSheets.length }) }}
        </p>

        <div class="sheet-dialog__layout">
          <ul class="sheet-dialog__list" role="listbox" :aria-label="t('sheet.listAria')">
            <li
              v-for="sheet in filteredSheets"
              :key="sheet.code"
              :class="{ 'sheet-dialog__item--active': selected?.code === sheet.code }"
              role="option"
              :aria-selected="selected?.code === sheet.code"
              class="sheet-dialog__item"
              @click="selected = sheet"
            >
              <div>
                <p class="sheet-dialog__name">{{ sheet.brand }} {{ sheet.part }}</p>
                <p class="sheet-dialog__detail">
                  {{
                    t('sheet.detail', {
                      width: sheet.labelWidthMm,
                      height: sheet.labelHeightMm,
                      paper: sheet.paperSize,
                      perPage: sheet.layouts.reduce((sum, l) => sum + l.columns * l.rows, 0),
                    })
                  }}
                </p>
              </div>
            </li>
          </ul>

          <div class="sheet-dialog__preview">
            <SheetPreview v-if="selected" :sheet="selected" />
            <p v-else class="sheet-dialog__status">{{ t('sheet.previewHint') }}</p>
          </div>
        </div>

        <LimitBanner v-if="data.limited" :cta="t('data.rows.feedbackCta')">
          {{
            t('data.rows.limitMessage', {
              shown: data.rows.length,
              total: data.lastImport?.totalRowsInFile ?? data.rows.length,
            })
          }}
        </LimitBanner>
      </template>
    </div>

    <template #footer>
      <button type="button" class="sheet-dialog__btn" @click="emit('close')">
        {{ t('common.close') }}
      </button>
      <button
        type="button"
        class="sheet-dialog__btn sheet-dialog__btn--primary"
        :disabled="!selected"
        @click="onConfirm"
      >
        {{ t('output.sheetSetup.useThis') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SheetTemplate } from '@burnmark-io/sheet-templates';
import { useDataStore } from '@/stores/data';
import { usePrintConfigStore } from '@/stores/print-config';
import { useToast } from '@/composables/useToast';
import LimitBanner from '@/components/common/LimitBanner.vue';
import Modal from '@/components/common/Modal.vue';
import SheetPreview from './SheetPreview.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const data = useDataStore();
const config = usePrintConfigStore();
const { show } = useToast();

const loading = ref(false);
const sheets = ref<SheetTemplate[]>([]);
const brands = ref<string[]>([]);
const query = ref('');
const brandFilter = ref('');
const selected = ref<SheetTemplate | null>(null);

watch(
  () => props.open,
  async isOpen => {
    if (!isOpen) return;
    // Pre-select the currently configured template so re-opening lands
    // on the user's last choice.
    if (config.sheetTemplate) selected.value = config.sheetTemplate;
    if (sheets.value.length > 0) return;
    loading.value = true;
    try {
      const mod = await import('@burnmark-io/sheet-templates');
      sheets.value = mod.SHEETS;
      brands.value = mod.listBrands();
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      loading.value = false;
    }
  },
);

const filteredSheets = computed(() => {
  const q = query.value.trim().toLowerCase();
  return sheets.value.filter(sheet => {
    if (brandFilter.value && sheet.brand !== brandFilter.value) return false;
    if (!q) return true;
    return (
      sheet.brand.toLowerCase().includes(q) ||
      sheet.part.toLowerCase().includes(q) ||
      sheet.code.toLowerCase().includes(q) ||
      sheet.name.toLowerCase().includes(q)
    );
  });
});

function onConfirm(): void {
  if (!selected.value) return;
  config.setSheetTemplate(selected.value);
  emit('close');
}
</script>

<style scoped>
.sheet-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sheet-dialog__filters {
  display: flex;
  gap: var(--space-2);
}

.sheet-dialog__search {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.sheet-dialog__brand {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--color-bg-panel);
}

.sheet-dialog__count {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.sheet-dialog__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
  height: 360px;
}

.sheet-dialog__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-canvas);
}

.sheet-dialog__item {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}

.sheet-dialog__item:hover {
  background: var(--color-primary-subtle);
}

.sheet-dialog__item--active {
  background: var(--color-primary-light);
  color: var(--color-primary-text);
}

.sheet-dialog__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.sheet-dialog__item--active .sheet-dialog__name {
  color: var(--color-primary-text);
}

.sheet-dialog__detail {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.sheet-dialog__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.sheet-dialog__status {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.sheet-dialog__btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
}

.sheet-dialog__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.sheet-dialog__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
