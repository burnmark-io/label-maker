<template>
  <form class="report-form" @submit.prevent="onSubmit">
    <p class="report-form__intro">{{ t('support.form.intro') }}</p>

    <fieldset class="report-form__fieldset">
      <legend class="report-form__legend">{{ t('support.form.resultLabel') }}</legend>
      <label
        v-for="opt in resultOptions"
        :key="opt.value"
        class="report-form__radio"
        :class="{ 'report-form__radio--active': result === opt.value }"
      >
        <input v-model="result" type="radio" name="result" :value="opt.value" />
        <span>{{ opt.label }}</span>
      </label>
    </fieldset>

    <label v-if="transportOptions.length > 1" class="report-form__field">
      <span class="report-form__label">{{ t('support.form.transportLabel') }}</span>
      <select v-model="transport" class="report-form__select">
        <option v-for="tt in transportOptions" :key="tt" :value="tt">{{ tt }}</option>
      </select>
    </label>

    <label class="report-form__field">
      <span class="report-form__label">{{ t('support.form.notesLabel') }}</span>
      <textarea
        v-model="notes"
        class="report-form__textarea"
        rows="3"
        :placeholder="t('support.form.notesPlaceholder')"
      />
    </label>

    <label class="report-form__check">
      <input v-model="includeDiagnostic" type="checkbox" />
      <span>
        <span class="report-form__check-label">{{ t('support.form.diagnosticToggle') }}</span>
        <span class="report-form__check-hint">{{ t('support.form.diagnosticHint') }}</span>
      </span>
    </label>

    <details v-if="includeDiagnostic && diagnosticPreview" class="report-form__diagnostic">
      <summary>{{ t('support.form.diagnosticPreview') }}</summary>
      <pre>{{ diagnosticPreview }}</pre>
    </details>

    <div class="report-form__actions">
      <button type="button" class="report-form__btn" @click="emit('cancel')">
        {{ t('support.form.cancel') }}
      </button>
      <button type="submit" class="report-form__btn report-form__btn--primary">
        {{ t('support.form.openIssue') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TransportType } from '@thermal-label/contracts';
import type { Connection, EngineSlotState } from '@/stores/printer';
import {
  availableTransports,
  buildReportBody,
  buildReportTitle,
  buildReportUrl,
  captureDiagnostic,
  detectBrowser,
  detectOs,
  type ReportResult,
} from '@/lib/support';

const props = defineProps<{
  connection: Connection;
  slot: EngineSlotState;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'submitted'): void;
}>();

const { t } = useI18n();

const result = ref<ReportResult>('verified');
const notes = ref('');
const includeDiagnostic = ref(false);

const transportOptions = computed<TransportType[]>(() => availableTransports(props.connection));

const transport = ref<TransportType>(transportOptions.value[0] ?? 'usb');

const resultOptions = computed(() => [
  { value: 'verified' as const, label: t('support.form.resultVerified') },
  { value: 'partial' as const, label: t('support.form.resultPartial') },
  { value: 'broken' as const, label: t('support.form.resultBroken') },
]);

const diagnosticPreview = computed(() => captureDiagnostic(props.connection, props.slot));

function onSubmit(): void {
  const family = props.connection.family;
  const model = props.connection.model;
  const title = buildReportTitle(family, model, transport.value);
  const body = buildReportBody({
    family,
    model,
    packageVersion: props.connection.device?.support.packageVersion,
    transport: transport.value,
    os: detectOs(),
    browser: detectBrowser(),
    result: result.value,
    notes: notes.value,
    diagnosticSnapshot: includeDiagnostic.value ? diagnosticPreview.value : undefined,
  });
  const url = buildReportUrl(family, title, body);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  emit('submitted');
}
</script>

<style scoped>
.report-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.report-form__intro {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.report-form__fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.report-form__legend {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: var(--space-1);
}

.report-form__radio {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
  font-size: var(--text-sm);
}

.report-form__radio:hover {
  background: var(--color-bg-panel);
}

.report-form__radio--active {
  background: var(--color-bg-panel);
  border-color: var(--color-primary);
}

.report-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.report-form__label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.report-form__select,
.report-form__textarea {
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-canvas);
  font-size: var(--text-sm);
  color: var(--color-text);
  font-family: inherit;
}

.report-form__textarea {
  resize: vertical;
  min-height: 60px;
}

.report-form__check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
}

.report-form__check input[type='checkbox'] {
  margin-top: 3px;
}

.report-form__check-label {
  display: block;
  font-weight: var(--weight-medium);
}

.report-form__check-hint {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.report-form__diagnostic {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.report-form__diagnostic pre {
  background: var(--color-bg-canvas);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  line-height: 1.5;
  margin: var(--space-1) 0 0;
  white-space: pre-wrap;
}

.report-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.report-form__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing);
}

.report-form__btn:hover {
  background: var(--color-bg);
}

.report-form__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: transparent;
}

.report-form__btn--primary:hover {
  background: var(--color-primary-hover);
}
</style>
