<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('properties.barcode.format') }}</span>
      <select
        :value="object.format"
        class="props__input"
        @change="update('format', ($event.target as HTMLSelectElement).value as BarcodeFormat)"
      >
        <optgroup v-for="group in groupedFormats" :key="group.label" :label="group.label">
          <option v-for="format in group.formats" :key="format" :value="format">
            {{ format }}
          </option>
        </optgroup>
      </select>
    </label>

    <label class="props__field">
      <span>{{ t('properties.barcode.data') }}</span>
      <textarea
        :value="object.data"
        rows="2"
        class="props__textarea"
        @input="update('data', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <label class="props__field">
      <span>{{ t('properties.barcode.scale') }} ({{ object.options.scale ?? 4 }})</span>
      <input
        type="range"
        min="1"
        max="12"
        :value="object.options.scale ?? 4"
        class="props__input"
        @input="updateOption('scale', Number(($event.target as HTMLInputElement).value))"
      />
    </label>

    <label v-if="isQrFormat" class="props__field">
      <span>{{ t('properties.barcode.errorCorrection') }}</span>
      <select
        :value="object.options.eclevel ?? 'M'"
        class="props__input"
        @change="
          updateOption(
            'eclevel',
            ($event.target as HTMLSelectElement).value as 'L' | 'M' | 'Q' | 'H',
          )
        "
      >
        <option value="L">{{ t('properties.barcode.ecLow') }} (L)</option>
        <option value="M">{{ t('properties.barcode.ecMedium') }} (M)</option>
        <option value="Q">{{ t('properties.barcode.ecQuartile') }} (Q)</option>
        <option value="H">{{ t('properties.barcode.ecHigh') }} (H)</option>
      </select>
    </label>

    <ToggleField
      v-if="!isQrFormat"
      :label="t('properties.barcode.includeText')"
      :model-value="object.options.includetext ?? true"
      @update:model-value="updateOption('includetext', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BarcodeFormat, BarcodeObject, BarcodeOptions } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import ToggleField from './ToggleField.vue';

const props = defineProps<{ object: BarcodeObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

const isQrFormat = computed(() => ['qrcode', 'gs1qrcode', 'microqr'].includes(props.object.format));

const groupedFormats = computed<{ label: string; formats: BarcodeFormat[] }[]>(() => [
  {
    label: '1D',
    formats: ['code128', 'code39', 'code93', 'codabar', 'ean13', 'ean8', 'upca', 'upce', 'itf14'],
  },
  {
    label: '2D',
    formats: ['qrcode', 'microqr', 'datamatrix', 'pdf417', 'azteccode', 'maxicode', 'dotcode'],
  },
  {
    label: 'GS1',
    formats: ['gs1_128', 'gs1qrcode', 'gs1datamatrix', 'databar', 'databarexpanded'],
  },
  {
    label: 'Postal',
    formats: ['postnet', 'royalmail', 'kix', 'auspost', 'japanpost'],
  },
]);

function update<K extends keyof BarcodeObject>(key: K, value: BarcodeObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<BarcodeObject>);
}

function updateOption<K extends keyof BarcodeOptions>(key: K, value: BarcodeOptions[K]): void {
  designer.updateObject(props.object.id, {
    options: { ...props.object.options, [key]: value },
  });
}
</script>

<style scoped>
@import './properties-panel.css';
</style>
