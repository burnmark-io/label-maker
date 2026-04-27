<template>
  <VGroup :config="{ listening: false }">
    <!-- Across-feed dimension label on the left edge -->
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

    <!-- Feed direction indicator: vertical (↓) on the right edge by default,
         horizontal (→) along the bottom edge in horizontal orientation. -->
    <template v-if="isHorizontal">
      <VText
        :config="{
          x: width - 60,
          y: height + 8,
          text: feedLabel,
          fontSize: 10 / scale,
          fontFamily: 'JetBrains Mono, monospace',
          fill: '#a8a29e',
        }"
      />
      <VLine
        :config="{
          points: [width - 40, height + 24, width + 4, height + 24],
          stroke: '#a8a29e',
          strokeWidth: 1 / scale,
        }"
      />
      <VLine
        :config="{
          points: [width + 4, height + 24, width - 4, height + 20],
          stroke: '#a8a29e',
          strokeWidth: 1 / scale,
        }"
      />
      <VLine
        :config="{
          points: [width + 4, height + 24, width - 4, height + 28],
          stroke: '#a8a29e',
          strokeWidth: 1 / scale,
        }"
      />
    </template>
    <template v-else>
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
    </template>
  </VGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMediaStore } from '@/stores/media';

const props = defineProps<{
  width: number;
  height: number;
  scale: number;
  dpi: number;
}>();

const { t } = useI18n();
const media = useMediaStore();

const ARROW_GUTTER = 26;

const isHorizontal = computed(() => media.orientation === 'horizontal');
const widthMm = computed(() => Math.round((props.width / props.dpi) * 25.4));
const feedLabel = computed(() => `${isHorizontal.value ? '→' : '↓'} ${t('canvas.feedDirection')}`);
</script>
