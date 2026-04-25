<template>
  <VGroup :config="{ listening: false }">
    <VLine
      v-for="x in verticalLines"
      :key="`v-${x}`"
      :config="{
        points: [x, 0, x, height],
        stroke: '#e7e5e4',
        strokeWidth: 1 / scale,
      }"
    />
    <VLine
      v-for="y in horizontalLines"
      :key="`h-${y}`"
      :config="{
        points: [0, y, width, y],
        stroke: '#e7e5e4',
        strokeWidth: 1 / scale,
      }"
    />
  </VGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  width: number;
  height: number;
  spacing: number;
  scale: number;
}>();

const verticalLines = computed(() => {
  const out: number[] = [];
  for (let x = props.spacing; x < props.width; x += props.spacing) out.push(x);
  return out;
});

const horizontalLines = computed(() => {
  const out: number[] = [];
  for (let y = props.spacing; y < props.height; y += props.spacing) out.push(y);
  return out;
});
</script>
