<template>
  <div class="output-panel">
    <PreviewSection />
    <PrintSection />
    <SaveAsFileSection />
  </div>
</template>

<script setup lang="ts">
import PreviewSection from '@/components/output/PreviewSection.vue';
import PrintSection from '@/components/output/PrintSection.vue';
import SaveAsFileSection from '@/components/output/SaveAsFileSection.vue';
</script>

<style scoped>
.output-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
