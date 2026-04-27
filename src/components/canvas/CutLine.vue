<template>
  <VGroup :config="{ listening: false }">
    <!-- Cut line follows the growth axis: bottom edge for vertical
         orientation, right edge for horizontal. -->
    <template v-if="isHorizontal">
      <VLine
        :config="{
          points: [width, 0, width, height],
          stroke: '#a8a29e',
          strokeWidth: 1.5 / scale,
          dash: [8 / scale, 6 / scale],
        }"
      />
      <VText
        :config="{
          x: width + 6,
          y: 6,
          text: cutLabel,
          fontSize: 10 / scale,
          fontFamily: 'JetBrains Mono, monospace',
          fill: '#a8a29e',
        }"
      />
    </template>
    <template v-else>
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
    </template>
  </VGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMediaStore } from '@/stores/media';

defineProps<{
  width: number;
  height: number;
  scale: number;
}>();

const { t } = useI18n();
const media = useMediaStore();
const isHorizontal = computed(() => media.orientation === 'horizontal');
const cutLabel = computed(() => `✂ ${t('canvas.cutLine')}`);
</script>
