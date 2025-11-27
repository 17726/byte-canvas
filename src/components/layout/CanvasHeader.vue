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
          <!-- TODO：Header额外功能预留空间，用于添加额外功能组件 -->
          <PropertyPanel/>
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
  width: 100%;
  max-width: 700px;
  height: 100%;
}
</style>
