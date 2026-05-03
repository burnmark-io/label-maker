<template>
  <Modal
    :open="open"
    size="md"
    :title="t('support.sheet.title')"
    :close-label="t('support.sheet.close')"
    @close="onClose"
  >
    <div v-if="connection && slot" class="support-sheet">
      <DeviceReportForm
        v-if="view === 'form'"
        :slot="slot"
        :connection="connection"
        @cancel="view = 'info'"
        @submitted="onClose"
      />

      <template v-else>
        <header class="support-sheet__header">
          <div class="support-sheet__title-line">
            <p class="support-sheet__model">{{ connectionLabel }}</p>
            <span
              v-if="effective.status !== 'verified'"
              class="support-sheet__chip"
              :class="`support-sheet__chip--${effective.status}`"
            >
              {{ t(`support.sheet.status${capitalize(effective.status)}`) }}
            </span>
            <span v-else class="support-sheet__chip support-sheet__chip--verified">
              {{ t('support.sheet.statusVerified') }}
            </span>
          </div>
          <p v-if="effective.support.lastVerified" class="support-sheet__meta">
            {{ t('support.sheet.lastVerified', { date: effective.support.lastVerified }) }}
          </p>
          <p v-if="effective.support.packageVersion" class="support-sheet__meta">
            {{ t('support.sheet.packageVersion', { package: effective.support.packageVersion }) }}
          </p>
        </header>

        <section v-if="transportEntries.length > 0" class="support-sheet__section">
          <h3 class="support-sheet__heading">{{ t('support.sheet.transportsHeading') }}</h3>
          <ul class="support-sheet__list">
            <li v-for="(entry, idx) in transportEntries" :key="idx">
              <span class="support-sheet__list-key">{{ entry.key }}</span>
              <span class="support-sheet__pill" :class="`support-sheet__pill--${entry.status}`">{{
                t(`support.sheet.status${capitalize(entry.status)}`)
              }}</span>
            </li>
          </ul>
        </section>

        <section v-if="engineEntries.length > 0" class="support-sheet__section">
          <h3 class="support-sheet__heading">{{ t('support.sheet.enginesHeading') }}</h3>
          <ul class="support-sheet__list">
            <li v-for="(entry, idx) in engineEntries" :key="idx">
              <span class="support-sheet__list-key">{{ entry.role }}</span>
              <span class="support-sheet__pill" :class="`support-sheet__pill--${entry.status}`">{{
                t(`support.sheet.status${capitalize(entry.status)}`)
              }}</span>
            </li>
          </ul>
        </section>

        <section class="support-sheet__section">
          <h3 class="support-sheet__heading">{{ t('support.sheet.quirksHeading') }}</h3>
          <p v-if="effective.support.quirks" class="support-sheet__quirks">
            {{ effective.support.quirks }}
          </p>
          <p v-else class="support-sheet__muted">{{ t('support.sheet.noQuirks') }}</p>
        </section>

        <section class="support-sheet__section">
          <h3 class="support-sheet__heading">{{ t('support.sheet.reportsHeading') }}</h3>
          <ul v-if="reports.length > 0" class="support-sheet__reports">
            <li v-for="r in reports" :key="r.issue">
              <a
                :href="reportIssueUrl(r.issue)"
                target="_blank"
                rel="noopener noreferrer"
                class="support-sheet__report-link"
              >
                #{{ r.issue }}
              </a>
              <span>
                {{
                  r.os
                    ? t('support.sheet.reportLine', {
                        result: t(`support.sheet.status${capitalize(r.result)}`),
                        os: r.os,
                        reporter: r.reporter,
                        date: r.date,
                      })
                    : t('support.sheet.reportLineNoOs', {
                        result: t(`support.sheet.status${capitalize(r.result)}`),
                        reporter: r.reporter,
                        date: r.date,
                      })
                }}
                <span v-if="r.selfVerified" class="support-sheet__muted">
                  {{ t('support.sheet.reportSelfVerified') }}
                </span>
              </span>
            </li>
          </ul>
          <p v-else class="support-sheet__muted">{{ t('support.sheet.noReports') }}</p>
        </section>
      </template>
    </div>

    <template v-if="view === 'info' && connection" #footer>
      <button class="support-sheet__btn" type="button" @click="onClose">
        {{ t('support.sheet.close') }}
      </button>
      <button
        class="support-sheet__btn support-sheet__btn--primary"
        type="button"
        @click="view = 'form'"
      >
        {{ t('support.sheet.fileReport') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SupportStatus, TransportType } from '@thermal-label/contracts';

import Modal from '@/components/common/Modal.vue';
import DeviceReportForm from './DeviceReportForm.vue';
import { usePrinterStore } from '@/stores/printer';
import { getEffectiveSupport, reportUrlBaseFor } from '@/lib/support';

const props = defineProps<{
  open: boolean;
  connectionId: string | null;
  role: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
const printer = usePrinterStore();

type View = 'info' | 'form';
const view = ref<View>('info');

watch(
  () => props.open,
  isOpen => {
    if (isOpen) view.value = 'info';
  },
);

const connection = computed(() => {
  if (!props.connectionId) return null;
  return printer.getConnection(props.connectionId) ?? null;
});

const slot = computed(() => {
  const conn = connection.value;
  if (!conn || !props.role) return null;
  return conn.slots.get(props.role) ?? null;
});

const connectionLabel = computed(() => {
  const conn = connection.value;
  if (!conn) return '';
  const base = conn.nickname ?? conn.model;
  if (!props.role || props.role === 'primary') return base;
  return `${base} — ${props.role}`;
});

const effective = computed(() => {
  const conn = connection.value;
  const s = slot.value;
  if (!conn || !s) {
    return {
      status: 'untested' as SupportStatus,
      support: { status: 'untested' as SupportStatus },
      engineStatus: undefined,
    };
  }
  return getEffectiveSupport(conn, s);
});

const transportEntries = computed(() => {
  const transports = effective.value.support.transports;
  if (!transports) return [];
  return (Object.entries(transports) as Array<[TransportType, SupportStatus]>).map(
    ([key, status]) => ({ key, status }),
  );
});

const engineEntries = computed(() => {
  const engines = effective.value.support.engines;
  if (!engines) return [];
  return Object.entries(engines).map(([role, status]) => ({ role, status }));
});

const reports = computed(() => effective.value.support.reports ?? []);

function reportIssueUrl(issueNumber: number): string {
  const conn = connection.value;
  if (!conn) return '#';
  const base = reportUrlBaseFor(conn.family);
  return base.replace(/\/issues\/new$/, `/issues/${issueNumber}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function onClose(): void {
  emit('close');
}
</script>

<style scoped>
.support-sheet {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.support-sheet__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.support-sheet__title-line {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.support-sheet__model {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.support-sheet__chip {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: var(--weight-medium);
}

.support-sheet__chip--verified {
  background: rgba(22, 163, 74, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(22, 163, 74, 0.4);
}

.support-sheet__chip--partial {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.support-sheet__chip--broken {
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
  border: 1px solid rgba(220, 38, 38, 0.4);
}

.support-sheet__chip--untested {
  background: var(--color-bg-canvas);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.support-sheet__meta {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.support-sheet__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.support-sheet__heading {
  margin: 0 0 var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.support-sheet__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.support-sheet__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.support-sheet__list-key {
  color: var(--color-text);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
}

.support-sheet__pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-weight: var(--weight-medium);
}

.support-sheet__pill--verified {
  background: rgba(22, 163, 74, 0.1);
  color: var(--color-success);
}

.support-sheet__pill--partial {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
}

.support-sheet__pill--broken {
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
}

.support-sheet__pill--untested {
  background: var(--color-bg-canvas);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.support-sheet__quirks {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.5;
  white-space: pre-wrap;
}

.support-sheet__muted {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.support-sheet__reports {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.support-sheet__reports li {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
}

.support-sheet__report-link {
  color: var(--color-primary);
  text-decoration: none;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  flex-shrink: 0;
}

.support-sheet__report-link:hover {
  text-decoration: underline;
}

.support-sheet__btn {
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

.support-sheet__btn:hover {
  background: var(--color-bg);
}

.support-sheet__btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: transparent;
}

.support-sheet__btn--primary:hover {
  background: var(--color-primary-hover);
}
</style>
