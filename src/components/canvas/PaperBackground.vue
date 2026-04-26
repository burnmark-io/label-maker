<template>
  <VRect
    :config="{
      x: 0,
      y: 0,
      width,
      height,
      fill: fill ?? '#ffffff',
      stroke: dashed ? undefined : '#d6d3d1',
      strokeWidth: dashed ? 0 : 1 / scale,
      cornerRadius: effectiveCornerRadius,
      shadowColor: 'rgba(28, 25, 23, 0.12)',
      shadowBlur: 12 / scale,
      shadowOffset: { x: 0, y: 2 / scale },
      shadowOpacity: 1,
      listening: false,
    }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  width: number;
  height: number;
  scale: number;
  /** Canvas background colour from the document. Falls back to white. */
  fill?: string;
  /** If true, the bottom edge fades to a dashed cut line — for continuous labels. */
  dashed?: boolean;
  /**
   * Corner radius in dot-space, sourced from the media descriptor or
   * sheet template (per `amendment-canvas-sizing.md` §7.6). Falls back
   * to a small visual softening when undefined — square corners would
   * also be a defensible default but the existing UI uses 2 dots, so
   * we keep the soft-edge unless a real radius is provided.
   */
  cornerRadiusDots?: number;
}>();

const effectiveCornerRadius = computed(() => {
  if (props.dashed) return 0;
  if (typeof props.cornerRadiusDots === 'number' && props.cornerRadiusDots > 0) {
    return props.cornerRadiusDots;
  }
  return 2;
});
</script>
