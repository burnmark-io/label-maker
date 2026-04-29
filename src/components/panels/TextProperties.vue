<template>
  <div class="props">
    <!-- Font + size, on one line. -->
    <div class="props__row">
      <label class="props__field">
        <span>{{ t('properties.text.fontFamily') }}</span>
        <select
          :value="object.fontFamily"
          class="props__input"
          @change="update('fontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="font in fonts" :key="font" :value="font">{{ font }}</option>
        </select>
      </label>
      <label class="props__field props__field--narrow">
        <span>{{ t('properties.text.fontSize') }}</span>
        <input
          type="number"
          :value="object.fontSize"
          min="6"
          max="600"
          class="props__input"
          @input="update('fontSize', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <!-- Formatting toolbar — sits adjacent to the textarea so the user
         sees "what's about to change" right above the content. -->
    <div class="props__group" role="group">
      <button
        type="button"
        class="props__chip"
        :class="{ 'props__chip--active': object.fontWeight === 'bold' }"
        :aria-pressed="object.fontWeight === 'bold'"
        :aria-label="t('properties.text.bold')"
        @click="update('fontWeight', object.fontWeight === 'bold' ? 'normal' : 'bold')"
      >
        B
      </button>
      <button
        type="button"
        class="props__chip props__chip--italic"
        :class="{ 'props__chip--active': object.fontStyle === 'italic' }"
        :aria-pressed="object.fontStyle === 'italic'"
        :aria-label="t('properties.text.italic')"
        @click="update('fontStyle', object.fontStyle === 'italic' ? 'normal' : 'italic')"
      >
        I
      </button>
      <span class="props__divider" />
      <button
        type="button"
        class="props__chip"
        :class="{ 'props__chip--active': object.textAlign === 'left' }"
        :aria-pressed="object.textAlign === 'left'"
        :aria-label="t('properties.text.alignLeft')"
        @click="update('textAlign', 'left')"
      >
        ⫷
      </button>
      <button
        type="button"
        class="props__chip"
        :class="{ 'props__chip--active': object.textAlign === 'center' }"
        :aria-pressed="object.textAlign === 'center'"
        :aria-label="t('properties.text.alignCenter')"
        @click="update('textAlign', 'center')"
      >
        ☰
      </button>
      <button
        type="button"
        class="props__chip"
        :class="{ 'props__chip--active': object.textAlign === 'right' }"
        :aria-pressed="object.textAlign === 'right'"
        :aria-label="t('properties.text.alignRight')"
        @click="update('textAlign', 'right')"
      >
        ⫸
      </button>
    </div>

    <!-- Colour + invert on one line, between the toolbar and content. -->
    <div class="props__inline-row">
      <ColorPicker
        :label="t('properties.color')"
        :value="object.color"
        @update:value="update('color', $event)"
      />
      <ToggleField
        :label="t('properties.text.invert')"
        :model-value="object.invert"
        @update:model-value="update('invert', $event)"
      />
    </div>

    <!-- The thing the user is here to edit. -->
    <label class="props__field">
      <span class="props__sr-only">{{ t('properties.text.content') }}</span>
      <textarea
        :value="object.content"
        rows="3"
        class="props__textarea"
        :placeholder="t('properties.text.content')"
        @input="update('content', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <CollapsibleSection
      :title="t('properties.text.style')"
      :storage-key="`properties.collapsible.text.style`"
    >
      <label class="props__field">
        <span>{{ t('properties.text.letterSpacing') }}</span>
        <HybridNumberInput
          :model-value="object.letterSpacing ?? 0"
          :min="-10"
          :max="50"
          :step="0.5"
          :ariaLabel="t('properties.text.letterSpacing')"
          @update:model-value="update('letterSpacing', $event)"
        />
      </label>

      <label class="props__field">
        <span>{{ t('properties.text.lineHeight') }}</span>
        <HybridNumberInput
          :model-value="object.lineHeight ?? 1.2"
          :min="0.8"
          :max="3"
          :step="0.05"
          :ariaLabel="t('properties.text.lineHeight')"
          @update:model-value="update('lineHeight', $event)"
        />
      </label>

      <ToggleField
        :label="t('properties.text.wrap')"
        :model-value="object.wrap"
        @update:model-value="update('wrap', $event)"
      />
      <ToggleField
        :label="t('properties.text.autoHeight')"
        :model-value="object.autoHeight"
        @update:model-value="update('autoHeight', $event)"
      />
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
import type { TextObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import ColorPicker from './ColorPicker.vue';
import ToggleField from './ToggleField.vue';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';
import CollapsibleSection from '@/components/common/CollapsibleSection.vue';

const props = defineProps<{ object: TextObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

const fonts = [
  'Inter',
  'JetBrains Mono',
  'Bitter',
  'Barlow Condensed',
  'Arial',
  'Helvetica',
  'Courier New',
];

function update<K extends keyof TextObject>(key: K, value: TextObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<TextObject>);
}
</script>

<style scoped>
@import './properties-panel.css';

.props__inline-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.props__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
