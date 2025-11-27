<template>
  <div :style="{ background: 'var(--color-fill-2)' }">
    <a-page-header
      :style="{ background: 'var(--color-bg-2)', paddingLeft:'15px' }"
      title="Byte Canvas"
      subtitle="无限画布"
      :show-back="false"
    >
      <template #extra>
        <div class="extra">
          <property-panel></property-panel>
        </div>
      </template>
    </a-page-header>
  </div>
</template>

<script setup lang="ts">
import PropertyPanel from '@/components/layout/PropertyPanel.vue';
</script>

<style scoped>
.extra {
  width: 700px;
  height: 100%;
}
</style>
