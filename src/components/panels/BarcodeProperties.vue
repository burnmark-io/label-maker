<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('properties.barcode.format') }}</span>
      <select
        :value="live.format"
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

    <div class="props__field">
      <div class="props__label-row">
        <span :id="dataLabelId">{{ t('properties.barcode.data') }}</span>
        <InsertVariableButton
          :placeholders="data.placeholders"
          :aria-label="t('properties.barcode.insertVariable')"
          @insert="onInsertVariable"
        />
      </div>
      <textarea
        ref="textareaRef"
        :value="live.data"
        rows="2"
        :class="['props__textarea', validationClass]"
        :aria-invalid="validation.severity === 'error' ? true : undefined"
        :aria-describedby="dataHelpId"
        :aria-labelledby="dataLabelId"
        :placeholder="t(rule.placeholderKey)"
        @input="onDataInput"
      />
      <p
        v-if="helpMessage"
        :id="dataHelpId"
        :class="['props__help', `props__help--${validation.severity}`]"
      >
        {{ helpMessage }}
      </p>
    </div>

    <CollapsibleSection
      :title="t('properties.barcode.encoding')"
      storage-key="properties.collapsible.barcode.encoding"
    >
      <label class="props__field">
        <span>{{ t('properties.barcode.scale') }}</span>
        <HybridNumberInput
          :model-value="live.options.scale ?? 4"
          :min="1"
          :max="12"
          :step="1"
          :ariaLabel="t('properties.barcode.scale')"
          @update:model-value="updateOption('scale', $event)"
        />
      </label>

      <label v-if="isQrFormat" class="props__field">
        <span>{{ t('properties.barcode.errorCorrection') }}</span>
        <select
          :value="live.options.eclevel ?? 'M'"
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
        :model-value="live.options.includetext ?? true"
        @update:model-value="updateOption('includetext', $event)"
      />
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { BarcodeFormat, BarcodeObject, BarcodeOptions } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useDataStore } from '@/stores/data';
import { applyMask, getRule, hasPlaceholders, validate } from '@/lib/barcode/validation';
import InsertVariableButton from './InsertVariableButton.vue';
import ToggleField from './ToggleField.vue';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';
import CollapsibleSection from '@/components/common/CollapsibleSection.vue';

const props = defineProps<{ object: BarcodeObject }>();
const { t } = useI18n();
const designer = useDesignerStore();
const data = useDataStore();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

// designer-core mutates objects in place, so `props.object` keeps the
// same reference after `update`. Reading individual fields off that raw
// object isn't reactive — the computeds below would never re-run when
// the user picks a different format. Look up the live object through
// the store on every document change instead. The `void` touches the
// ShallowRef the designer store force-triggers on each `change`.
const live = computed<BarcodeObject>(() => {
  void designer.document;
  return (designer.get(props.object.id) as BarcodeObject | undefined) ?? props.object;
});

const dataLabelId = computed(() => `barcode-data-label-${props.object.id}`);
const dataHelpId = computed(() => `barcode-data-help-${props.object.id}`);

const isQrFormat = computed(() => ['qrcode', 'gs1qrcode', 'microqr'].includes(live.value.format));

const rule = computed(() => getRule(live.value.format));
const validation = computed(() => validate(live.value.format, live.value.data));

const helpMessage = computed(() => {
  // Empty input shows the format-specific hint (info severity), not
  // the generic "type something" line — gives the user concrete shape
  // and an example before they type anything (§5.2, §7.1).
  if (live.value.data.length === 0) return t(rule.value.hintKey);
  const v = validation.value;
  if (v.severity === 'ok') return '';
  if (!v.message) return '';
  return t(v.message, v.messageParams ?? {});
});

const validationClass = computed(() => {
  switch (validation.value.severity) {
    case 'error':
      return 'props__textarea--error';
    case 'warning':
      return 'props__textarea--warning';
    default:
      return '';
  }
});

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
    options: { ...live.value.options, [key]: value },
  });
}

function onDataInput(event: Event): void {
  const el = event.target as HTMLTextAreaElement;
  const raw = el.value;
  const caret = el.selectionStart ?? raw.length;
  const next = hasPlaceholders(raw) ? raw : applyMask(live.value.format, raw);
  if (next === raw) {
    update('data', next);
    return;
  }
  // Mask filtered the string. Write the masked value back through the
  // store and restore a sensible caret position so typing doesn't jump.
  update('data', next);
  void nextTick(() => {
    const ta = textareaRef.value;
    if (!ta) return;
    const pos = Math.min(caret, next.length);
    ta.setSelectionRange(pos, pos);
  });
}

function onInsertVariable(name: string): void {
  const ta = textareaRef.value;
  const current = live.value.data;
  const insert = `{{${name}}}`;
  let start = current.length;
  let end = current.length;
  if (ta) {
    start = ta.selectionStart ?? current.length;
    end = ta.selectionEnd ?? current.length;
  }
  const next = current.slice(0, start) + insert + current.slice(end);
  update('data', next);
  void nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    el.focus();
    const pos = start + insert.length;
    el.setSelectionRange(pos, pos);
  });
}
</script>

<style scoped>
@import './properties-panel.css';
</style>
