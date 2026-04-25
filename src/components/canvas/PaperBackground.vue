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
      cornerRadius: dashed ? 0 : 2,
      shadowColor: 'rgba(28, 25, 23, 0.12)',
      shadowBlur: 12 / scale,
      shadowOffset: { x: 0, y: 2 / scale },
      shadowOpacity: 1,
      listening: false,
    }"
  />
</template>

<script setup lang="ts">
defineProps<{
  width: number;
  height: number;
  scale: number;
  /** Canvas background colour from the document. Falls back to white. */
  fill?: string;
  /** If true, the bottom edge fades to a dashed cut line — for continuous labels. */
  dashed?: boolean;
}>();
</script>
