<template>
  <Modal :open="open" size="md" :title="title" :close-label="t('common.close')" @close="onClose">
    <div class="help">
      <button v-if="view !== 'menu'" class="help__back" type="button" @click="view = 'menu'">
        ← {{ t('help.back') }}
      </button>

      <ul v-if="view === 'menu'" class="help__menu">
        <li>
          <button class="help__item" type="button" @click="onRestartTour">
            <span class="help__icon" aria-hidden="true">🎓</span>
            <span class="help__item-body">
              <span class="help__item-title">{{ t('help.restartTour') }}</span>
              <span class="help__item-hint">{{ t('help.restartTourHint') }}</span>
            </span>
          </button>
        </li>
        <li>
          <button class="help__item" type="button" @click="view = 'shortcuts'">
            <span class="help__icon" aria-hidden="true">⌨️</span>
            <span class="help__item-body">
              <span class="help__item-title">{{ t('help.shortcuts') }}</span>
              <span class="help__item-hint">{{ t('help.shortcutsHint') }}</span>
            </span>
          </button>
        </li>
        <li>
          <button class="help__item" type="button" @click="view = 'compat'">
            <span class="help__icon" aria-hidden="true">🖨️</span>
            <span class="help__item-body">
              <span class="help__item-title">{{ t('help.compatibility') }}</span>
              <span class="help__item-hint">{{ t('help.compatibilityHint') }}</span>
            </span>
          </button>
        </li>
        <li>
          <a class="help__item" :href="docsUrl" target="_blank" rel="noopener noreferrer">
            <span class="help__icon" aria-hidden="true">📖</span>
            <span class="help__item-body">
              <span class="help__item-title">{{ t('help.docs') }}</span>
              <span class="help__item-hint">{{ t('help.docsHint') }}</span>
            </span>
          </a>
        </li>
        <li>
          <a class="help__item" :href="reportUrl" target="_blank" rel="noopener noreferrer">
            <span class="help__icon" aria-hidden="true">🐛</span>
            <span class="help__item-body">
              <span class="help__item-title">{{ t('help.report') }}</span>
              <span class="help__item-hint">{{ t('help.reportHint') }}</span>
            </span>
          </a>
        </li>
        <li>
          <a class="help__item" :href="featureUrl" target="_blank" rel="noopener noreferrer">
            <span class="help__icon" aria-hidden="true">💬</span>
            <span class="help__item-body">
              <span class="help__item-title">{{ t('help.feature') }}</span>
              <span class="help__item-hint">{{ t('help.featureHint') }}</span>
            </span>
          </a>
        </li>
      </ul>

      <div v-else-if="view === 'shortcuts'" class="help__shortcuts">
        <section v-for="group in shortcutGroups" :key="group.title" class="help__group">
          <h3 class="help__group-title">{{ group.title }}</h3>
          <dl class="help__shortcut-list">
            <template v-for="row in group.items" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>
                <kbd v-for="(k, i) in row.keys" :key="i">{{ k }}</kbd>
              </dd>
            </template>
          </dl>
        </section>
      </div>

      <div v-else-if="view === 'compat'" class="help__compat">
        <p>{{ t('help.compatIntro') }}</p>
        <ul class="help__compat-list">
          <li>✅ {{ t('help.compatChrome') }}</li>
          <li>✅ {{ t('help.compatEdge') }}</li>
          <li>⚠️ {{ t('help.compatFirefox') }}</li>
          <li>⚠️ {{ t('help.compatSafari') }}</li>
        </ul>
        <h3 class="help__group-title">{{ t('help.compatPrintersHeading') }}</h3>
        <ul class="help__compat-list help__compat-list--bullet">
          <li>{{ t('help.compatBrother') }}</li>
          <li>{{ t('help.compatDymoLW') }}</li>
          <li>{{ t('help.compatDymoLM') }}</li>
        </ul>
        <h3 class="help__group-title">{{ t('help.compatConnectHeading') }}</h3>
        <p>{{ t('help.compatConnectBody') }}</p>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'restart-tour'): void;
}>();

const { t } = useI18n();

type View = 'menu' | 'shortcuts' | 'compat';
const view = ref<View>('menu');

watch(
  () => props.open,
  isOpen => {
    if (isOpen) view.value = 'menu';
  },
);

const cmd =
  typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
    ? '⌘'
    : 'Ctrl';

const docsUrl = 'https://thermal-label.github.io/';
const reportUrl = 'https://github.com/burnmark-io/label-maker/issues';
const featureUrl = 'https://github.com/burnmark-io/label-maker/discussions';

const title = computed(() => {
  if (view.value === 'shortcuts') return t('help.shortcutsTitle');
  if (view.value === 'compat') return t('help.compatTitle');
  return t('help.title');
});

const shortcutGroups = computed(() => [
  {
    title: t('help.shortcutsGroupGeneral'),
    items: [
      { label: t('shortcuts.general.undo'), keys: [cmd, 'Z'] },
      { label: t('shortcuts.general.redo'), keys: [cmd, 'Shift', 'Z'] },
      { label: t('shortcuts.general.selectAll'), keys: [cmd, 'A'] },
      { label: t('shortcuts.general.copy'), keys: [cmd, 'C'] },
      { label: t('shortcuts.general.paste'), keys: [cmd, 'V'] },
      { label: t('shortcuts.general.duplicate'), keys: [cmd, 'D'] },
      { label: t('shortcuts.general.deselect'), keys: ['Esc'] },
      { label: t('shortcuts.ui.help'), keys: ['?'] },
    ],
  },
  {
    title: t('help.shortcutsGroupCanvas'),
    items: [
      { label: t('shortcuts.canvas.zoom'), keys: [cmd, 'Wheel'] },
      { label: t('shortcuts.canvas.resetZoom'), keys: ['Double-click'] },
      { label: t('shortcuts.canvas.nudge'), keys: ['Arrow keys'] },
      { label: t('shortcuts.canvas.nudgeBig'), keys: ['Shift', 'Arrow'] },
    ],
  },
  {
    title: t('help.shortcutsGroupObjects'),
    items: [
      { label: t('shortcuts.objects.delete'), keys: ['Delete'] },
      { label: t('shortcuts.objects.raise'), keys: [cmd, ']'] },
      { label: t('shortcuts.objects.lower'), keys: [cmd, '['] },
      { label: t('shortcuts.objects.raiseTop'), keys: [cmd, 'Shift', ']'] },
      { label: t('shortcuts.objects.lowerBottom'), keys: [cmd, 'Shift', '['] },
    ],
  },
]);

function onRestartTour(): void {
  emit('restart-tour');
  emit('close');
}

function onClose(): void {
  emit('close');
}
</script>

<style scoped>
.help {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.55;
}

.help__back {
  align-self: flex-start;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.help__back:hover {
  color: var(--color-text);
  background: var(--color-bg-canvas);
}

.help__menu {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.help__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text);
  text-decoration: none;
}

.help__item:hover {
  background: var(--color-bg-canvas);
  border-color: var(--color-border);
  text-decoration: none;
}

.help__icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.help__item-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.help__item-title {
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.help__item-hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.help__shortcuts,
.help__compat {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.help__group-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: var(--space-2);
}

.help__shortcut-list {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-1) var(--space-3);
  margin: 0;
}

.help__shortcut-list dt {
  color: var(--color-text);
}

.help__shortcut-list dd {
  margin: 0;
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

kbd {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  min-width: 22px;
  justify-content: center;
}

.help__compat-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.help__compat-list--bullet {
  padding-left: var(--space-4);
  list-style: disc;
}

.help__compat-list--bullet li {
  display: list-item;
}
</style>
