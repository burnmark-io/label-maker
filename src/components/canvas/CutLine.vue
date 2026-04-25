<template>
  <VGroup :config="{ listening: false }">
    <VLine
      :config="{
        points: [0, height, width, height],
        stroke: '#a8a29e',
        strokeWidth: 1.5 / scale,
        dash: [8 / scale, 6 / scale],
      }"
    />
    <VText
      :config="{
        x: width - 80,
        y: height + 6,
        text: cutLabel,
        fontSize: 10 / scale,
        fontFamily: 'JetBrains Mono, monospace',
        fill: '#a8a29e',
      }"
    />
  </VGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  width: number;
  height: number;
  scale: number;
}>();

const { t } = useI18n();
const cutLabel = computed(() => `✂ ${t('canvas.cutLine')}`);
</script>
