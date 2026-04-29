<template>
  <div class="props">
    <div class="image-preview">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="t('properties.image.previewAlt')"
        class="image-preview__img"
      />
      <div v-else class="image-preview__placeholder" aria-hidden="true">
        <span>🖼</span>
      </div>
      <button type="button" class="image-preview__replace" @click="onClickReplace">
        {{ t('properties.image.replace') }}
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="image-preview__file"
        @change="onFileSelected"
      />
    </div>

    <div class="props__inline-row">
      <label class="props__field">
        <span>{{ t('properties.image.fit') }}</span>
        <select
          :value="object.fit"
          class="props__input"
          @change="update('fit', ($event.target as HTMLSelectElement).value as ImageObject['fit'])"
        >
          <option value="contain">{{ t('properties.image.fitContain') }}</option>
          <option value="cover">{{ t('properties.image.fitCover') }}</option>
          <option value="fill">{{ t('properties.image.fitFill') }}</option>
          <option value="none">{{ t('properties.image.fitNone') }}</option>
        </select>
      </label>
      <ToggleField
        :label="t('properties.image.invert')"
        :model-value="object.invert"
        @update:model-value="update('invert', $event)"
      />
    </div>

    <CollapsibleSection
      :title="t('properties.image.thermal')"
      storage-key="properties.collapsible.image.thermal"
    >
      <label class="props__field">
        <span>{{ t('properties.image.threshold') }}</span>
        <HybridNumberInput
          :model-value="object.threshold"
          :min="0"
          :max="255"
          :step="1"
          :ariaLabel="t('properties.image.threshold')"
          @update:model-value="update('threshold', $event)"
        />
      </label>
      <ToggleField
        :label="t('properties.image.dither')"
        :model-value="object.dither"
        @update:model-value="update('dither', $event)"
      />
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import type { ImageObject } from '@burnmark-io/designer-core';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import ToggleField from './ToggleField.vue';
import HybridNumberInput from '@/components/common/HybridNumberInput.vue';
import CollapsibleSection from '@/components/common/CollapsibleSection.vue';

const props = defineProps<{ object: ImageObject }>();
const { t } = useI18n();
const designer = useDesignerStore();

const fileInputRef = ref<HTMLInputElement | null>(null);
const thumbnailUrl = ref<string | null>(null);

async function loadThumbnail(key: string | undefined | null): Promise<void> {
  // Revoke any existing object URL before swapping — assets stay around
  // for the document lifetime, but the URL handle is per-mount.
  if (thumbnailUrl.value) {
    URL.revokeObjectURL(thumbnailUrl.value);
    thumbnailUrl.value = null;
  }
  if (!key) return;
  try {
    const blob = await designer.assetLoader.loadAsBlob(key);
    thumbnailUrl.value = URL.createObjectURL(blob);
  } catch {
    thumbnailUrl.value = null;
  }
}

onMounted(() => {
  void loadThumbnail(props.object.assetKey);
});

watch(
  () => props.object.assetKey,
  key => {
    void loadThumbnail(key);
  },
);

onBeforeUnmount(() => {
  if (thumbnailUrl.value) URL.revokeObjectURL(thumbnailUrl.value);
});

function onClickReplace(): void {
  fileInputRef.value?.click();
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const key = await designer.assetLoader.storeFromBlob(file);
    update('assetKey', key);
  } finally {
    input.value = '';
  }
}

function update<K extends keyof ImageObject>(key: K, value: ImageObject[K]): void {
  designer.updateObject(props.object.id, { [key]: value } as Partial<ImageObject>);
}
</script>

<style scoped>
@import './properties-panel.css';

.image-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-transform: none;
  letter-spacing: 0;
}

.image-preview__img {
  display: block;
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.image-preview__placeholder {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: var(--color-text-muted);
}

.image-preview__replace {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  cursor: pointer;
}

.image-preview__replace:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}

.image-preview__file {
  display: none;
}

.props__inline-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
</style>
