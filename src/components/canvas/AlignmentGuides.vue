<template>
  <VGroup :config="{ listening: false }">
    <VLine
      v-for="x in vertical"
      :key="`gv-${x}`"
      :config="{
        points: [x, -extent, x, height + extent],
        stroke: '#f59e0b',
        strokeWidth: 1 / scale,
        dash: [6 / scale, 4 / scale],
      }"
    />
    <VLine
      v-for="y in horizontal"
      :key="`gh-${y}`"
      :config="{
        points: [-extent, y, width + extent, y],
        stroke: '#f59e0b',
        strokeWidth: 1 / scale,
        dash: [6 / scale, 4 / scale],
      }"
    />
  </VGroup>
</template>

<script setup lang="ts">
defineProps<{
  vertical: number[];
  horizontal: number[];
  width: number;
  height: number;
  scale: number;
}>();

const extent = 24;
</script>
