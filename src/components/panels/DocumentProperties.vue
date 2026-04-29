<template>
  <div class="props">
    <label class="props__field">
      <span>{{ t('document.name') }}</span>
      <input
        type="text"
        class="props__input"
        :value="doc.name ?? ''"
        :placeholder="t('document.untitled')"
        @input="onNameInput(($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="props__field">
      <span>{{ t('document.description') }}</span>
      <textarea
        class="props__input props__textarea"
        rows="3"
        :value="doc.description ?? ''"
        @input="onDescriptionInput(($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <label class="props__field">
      <span>{{ t('document.background') }}</span>
      <input
        type="color"
        class="props__input props__color"
        :value="doc.canvas.background ?? '#ffffff'"
        @input="onBackgroundInput(($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="props__field props__field--readonly">
      <span>{{ t('document.canvasSize') }}</span>
      <span class="props__readonly-value">{{ canvasSizeLabel }}</span>
      <span class="props__hint">{{ t('document.canvasSizeChange') }}</span>
    </div>

    <div class="props__field props__field--readonly">
      <span>{{ t('document.created') }}</span>
      <span class="props__readonly-value">{{ formatDate(doc.createdAt) }}</span>
    </div>

    <div class="props__field props__field--readonly">
      <span>{{ t('document.updated') }}</span>
      <span class="props__readonly-value">{{ formatDate(doc.updatedAt) }}</span>
    </div>

    <div class="props__field props__field--readonly">
      <span>{{ t('document.objectCount') }}</span>
      <span class="props__readonly-value">{{ doc.objects.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';

const { t, locale } = useI18n();
const designer = useDesignerStore();

const doc = computed(() => designer.document);

// Convert dots to mm using the document's DPI; cosmetic readout only.
const canvasSizeLabel = computed<string>(() => {
  const c = doc.value.canvas;
  const widthMm = (c.widthDots / c.dpi) * 25.4;
  const heightMm = c.heightDots > 0 ? (c.heightDots / c.dpi) * 25.4 : 0;
  if (heightMm === 0) return `${widthMm.toFixed(0)}mm × continuous`;
  return `${widthMm.toFixed(0)} × ${heightMm.toFixed(0)} mm`;
});

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(locale.value);
  } catch {
    return iso;
  }
}

function onNameInput(value: string): void {
  designer.setDocumentInfo({ name: value });
}

function onDescriptionInput(value: string): void {
  designer.setDocumentInfo({ description: value });
}

function onBackgroundInput(value: string): void {
  designer.setCanvas({ background: value });
}
</script>

<style scoped>
.props {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.props__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.props__input {
  font-size: var(--text-sm);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-canvas);
  color: var(--color-text);
  width: 100%;
  box-sizing: border-box;
}

.props__textarea {
  resize: vertical;
  min-height: 64px;
  font-family: inherit;
}

.props__color {
  height: 32px;
  padding: 2px;
  cursor: pointer;
}

.props__field--readonly .props__readonly-value {
  font-size: var(--text-sm);
  color: var(--color-text);
  padding: var(--space-2) 0;
}

.props__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: -2px;
}
</style>
