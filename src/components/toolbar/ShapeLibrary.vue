<template>
  <div ref="rootRef" class="shape-library" role="dialog" :aria-label="t('toolbar.shapeLibrary')">
    <section class="shape-library__group">
      <h3 class="shape-library__heading">{{ t('shapes.categories.basic') }}</h3>
      <div class="shape-library__grid">
        <button
          v-for="basic in basicShapes"
          :key="basic.id"
          type="button"
          class="shape-library__tile"
          :title="t(`shapes.basic.${basic.id}`)"
          :aria-label="t(`shapes.basic.${basic.id}`)"
          @click="onBasic(basic.id)"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path :d="basic.iconPath" :fill="basic.fillIcon ? 'currentColor' : 'none'" :stroke="basic.fillIcon ? 'none' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </section>

    <section class="shape-library__group">
      <h3 class="shape-library__heading">{{ t('shapes.categories.decorative') }}</h3>
      <div class="shape-library__grid">
        <button
          v-for="def in decorativeShapes"
          :key="def.id"
          type="button"
          class="shape-library__tile"
          :title="t(`shapes.decorative.${def.labelKey}`)"
          :aria-label="t(`shapes.decorative.${def.labelKey}`)"
          :disabled="busy"
          @click="onInsert(def.id)"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path :d="def.iconPath" fill="currentColor" />
          </svg>
        </button>
      </div>
    </section>

    <section class="shape-library__group">
      <h3 class="shape-library__heading">{{ t('shapes.categories.borders') }}</h3>
      <div class="shape-library__grid">
        <button
          v-for="def in borderShapes"
          :key="def.id"
          type="button"
          class="shape-library__tile shape-library__tile--wide"
          :title="t(`shapes.borders.${def.labelKey}`)"
          :aria-label="t(`shapes.borders.${def.labelKey}`)"
          :disabled="busy"
          @click="onInsert(def.id)"
        >
          <svg viewBox="0 0 24 24" width="40" height="28" aria-hidden="true">
            <path :d="def.iconPath" fill="none" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ShapeObject } from '@burnmark-io/designer-core';
import { useDesignerStore } from '@/stores/designer';
import { SHAPE_REGISTRY, findShape } from '@/lib/shapes/registry';
import { insertRegistryShape } from '@/lib/shapes/insert';

const { t } = useI18n();
const designer = useDesignerStore();
const busy = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

interface BasicTile {
  id: ShapeObject['shape'];
  iconPath: string;
  fillIcon: boolean;
}

const basicShapes: BasicTile[] = [
  {
    id: 'rectangle',
    iconPath: 'M4 6h16v12H4z',
    fillIcon: false,
  },
  {
    id: 'ellipse',
    iconPath: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
    fillIcon: false,
  },
  {
    id: 'line',
    iconPath: 'M5 18 L19 6',
    fillIcon: false,
  },
];

const decorativeShapes = computed(() =>
  SHAPE_REGISTRY.filter((s) => s.category === 'decorative'),
);
const borderShapes = computed(() => SHAPE_REGISTRY.filter((s) => s.category === 'border'));

function nextDropPoint(): { x: number; y: number } {
  const c = designer.document.canvas;
  const offset = (designer.document.objects.length % 5) * 12;
  return {
    x: Math.max(8, Math.round(c.widthDots / 2) - 100 + offset),
    y: Math.max(8, Math.round((c.heightDots || 240) / 2) - 30 + offset),
  };
}

function onBasic(shape: ShapeObject['shape']): void {
  const { x, y } = nextDropPoint();
  const isLine = shape === 'line';
  const id = designer.addObject<ShapeObject>({
    type: 'shape',
    x,
    y,
    width: isLine ? 200 : 160,
    height: isLine ? 4 : 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#1c1917',
    shape,
    fill: !isLine,
    strokeWidth: isLine ? 4 : 2,
    invert: false,
    cornerRadius: shape === 'rectangle' ? 8 : 0,
    ...(isLine ? { lineDirection: 'horizontal' as const } : {}),
  });
  designer.select([id]);
  emit('close');
}

async function onInsert(id: string): Promise<void> {
  const def = findShape(id);
  if (!def) return;
  busy.value = true;
  try {
    const newId = await insertRegistryShape(designer, def);
    if (newId && !def.isBorder) designer.select([newId]);
  } finally {
    busy.value = false;
    emit('close');
  }
}

function onDocumentClick(event: MouseEvent): void {
  const root = rootRef.value;
  if (!root) return;
  if (event.target instanceof Node && root.contains(event.target)) return;
  // Clicks on the trigger button are handled by the parent (which toggles
  // open state). We dismiss for any other outside click.
  if (event.target instanceof HTMLElement && event.target.closest('[data-shape-library-trigger]')) return;
  emit('close');
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close');
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.shape-library {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 320px;
  max-width: calc(100vw - var(--space-4) * 2);
  z-index: 10;
}

.shape-library__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shape-library__heading {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.shape-library__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-1);
}

.shape-library__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}

.shape-library__tile:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
}

.shape-library__tile:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.shape-library__tile:active:not(:disabled) {
  transform: scale(0.96);
}

.shape-library__tile:disabled {
  opacity: 0.5;
  cursor: progress;
}

.shape-library__tile--wide {
  grid-column: span 2;
}
</style>
