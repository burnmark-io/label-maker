<template>
  <VGroup :config="{ listening: false }">
    <!-- Width dimension label on the left edge -->
    <VText
      :config="{
        x: -ARROW_GUTTER,
        y: height / 2 - 8,
        text: `← ${widthMm}mm →`,
        fontSize: 10 / scale,
        fontFamily: 'JetBrains Mono, monospace',
        fill: '#a8a29e',
        rotation: -90,
        align: 'center',
      }"
    />

    <!-- Feed direction arrow on the right side, near bottom -->
    <VText
      :config="{
        x: width + 8,
        y: height - 60,
        text: feedLabel,
        fontSize: 10 / scale,
        fontFamily: 'JetBrains Mono, monospace',
        fill: '#a8a29e',
      }"
    />
    <VLine
      :config="{
        points: [width + 18, height - 40, width + 18, height + 4],
        stroke: '#a8a29e',
        strokeWidth: 1 / scale,
      }"
    />
    <VLine
      :config="{
        points: [width + 18, height + 4, width + 14, height - 4],
        stroke: '#a8a29e',
        strokeWidth: 1 / scale,
      }"
    />
    <VLine
      :config="{
        points: [width + 18, height + 4, width + 22, height - 4],
        stroke: '#a8a29e',
        strokeWidth: 1 / scale,
      }"
    />
  </VGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  width: number;
  height: number;
  scale: number;
  dpi: number;
}>();

const { t } = useI18n();

const ARROW_GUTTER = 26;

const widthMm = computed(() => Math.round((props.width / props.dpi) * 25.4));
const feedLabel = computed(() => `↓ ${t('canvas.feedDirection')}`);
</script>
