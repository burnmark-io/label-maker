<template>
  <svg
    :viewBox="`0 0 ${sheet.paperWidthMm} ${sheet.paperHeightMm}`"
    class="sheet-preview"
    :aria-label="t('sheet.previewAria', { name: sheet.name })"
  >
    <rect
      x="0"
      y="0"
      :width="sheet.paperWidthMm"
      :height="sheet.paperHeightMm"
      fill="white"
      stroke="var(--color-border-strong)"
      stroke-width="0.6"
    />
    <g v-for="(layout, layoutIndex) in sheet.layouts" :key="layoutIndex">
      <rect
        v-for="position in positionsForLayout(layout)"
        :key="`${layoutIndex}-${position.r}-${position.c}`"
        :x="position.x"
        :y="position.y"
        :width="sheet.labelWidthMm"
        :height="sheet.labelHeightMm"
        :rx="sheet.labelShape === 'rectangle' ? (sheet.cornerRadiusMm ?? 0) : undefined"
        :fill="layoutIndex === 0 ? 'var(--color-primary-subtle)' : 'rgba(245,158,11,0.18)'"
        stroke="var(--color-primary)"
        stroke-width="0.4"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { SheetTemplate, SheetLayout } from '@burnmark-io/sheet-templates';

const props = defineProps<{ sheet: SheetTemplate }>();
const { t } = useI18n();

interface Position {
  x: number;
  y: number;
  r: number;
  c: number;
}

function positionsForLayout(layout: SheetLayout): Position[] {
  const out: Position[] = [];
  for (let r = 0; r < layout.rows; r += 1) {
    for (let c = 0; c < layout.columns; c += 1) {
      out.push({
        x: layout.originXMm + c * layout.pitchXMm,
        y: layout.originYMm + r * layout.pitchYMm,
        r,
        c,
      });
    }
  }
  return out;
}

// Read prop so the linter doesn't complain about it being unused.
void props.sheet;
</script>

<style scoped>
.sheet-preview {
  max-width: 100%;
  max-height: 100%;
  height: auto;
}
</style>
