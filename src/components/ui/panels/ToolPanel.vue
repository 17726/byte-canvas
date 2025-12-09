<template>
  <!-- 使用 Arco Design 菜单 -->
  <div class="tool-menu">
    <a-menu
      mode="pop"
      showCollapseButton
      :default-collapsed="true"
      :selected-keys="selectedKeys"
      @menu-item-click="onMenuItemClick"
    >
      <!-- 元素创建列表 -->
      <a-sub-menu key="addGraphics">
        <template #icon><icon-plus /></template>
        <template #title>图形</template>
        <!-- 创建矩形 -->
        <a-menu-item key="addRect">
          <template #icon><square /></template>
          矩形
        </a-menu-item>
        <!-- 创建圆形 -->
        <a-menu-item key="addCircle">
          <template #icon><round /></template>
          圆形
        </a-menu-item>
      </a-sub-menu>
      <!-- 文本创建按钮 -->
      <a-menu-item key="addText">
        <template #icon><icon-edit /></template>
        文本
      </a-menu-item>

      <!-- 图片创建按钮 -->
      <ImageMenu />

      <!-- 元素删除按钮 -->
      <a-menu-item key="deleteSelected" :disabled="!hasSelection">
        <template #icon><icon-delete /></template>
        删除
      </a-menu-item>
      <!-- Canvas Settings moved to top-right header -->
    </a-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconPlus, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';
//TODO：UI开发完成后优化icon-park库的导入，针对按需导入减小打包体积
import { Square, Round } from '@icon-park/vue-next';
import { useCanvasStore } from '@/store/canvasStore';
import { useNodeActions } from '@/composables/useNodeActions';
import ImageMenu from '../common/ImageMenu.vue';

const { hasSelection, deleteSelected } = useNodeActions();

//NOTE：按钮返回值需提前在MenuKey进行注册
enum MenuKey {
  AddRect = 'addRect',
  AddCircle = 'addCircle',
  AddText = 'addText',
  Delete = 'deleteSelected',
}

const store = useCanvasStore();

// 高亮控制：根据当前创建工具同步高亮状态
const selectedKeys = computed(() => {
  switch (store.creationTool) {
    case 'rect':
      return [MenuKey.AddRect];
    case 'circle':
      return [MenuKey.AddCircle];
    case 'text':
      return [MenuKey.AddText];
    default:
      return [];
  }
});

function onMenuItemClick(key: string) {
  switch (key) {
    case MenuKey.AddRect:
      //console.log('矩形工具被激活');
      store.setCreationTool('rect');
      break;
    case MenuKey.AddCircle:
      //console.log('圆形工具被激活');
      store.setCreationTool('circle');
      break;
    case MenuKey.AddText:
      //console.log('文本工具被激活');
      store.setCreationTool('text');
      break;
    case MenuKey.Delete:
      deleteSelected();
      break;
    default:
      console.warn(`未处理的菜单项: ${key}`);
      break;
  }
}
</script>

<style scoped>
.tool-menu {
  width: 250px;
  height: 500px;
  padding: 40px;
  position: fixed;
  left: 0;
  top: 80px;
  pointer-events: none;
  z-index: 1002;
}

.tool-menu .arco-menu {
  width: 150px;
  height: 400px;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  border-radius: 22px 22px 0 22px;
}

.tool-menu .arco-menu :deep(.arco-menu-collapse-button) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.tool-menu .arco-menu:not(.arco-menu-collapsed) :deep(.arco-menu-collapse-button) {
  right: 0;
  bottom: 8px;
  transform: translateX(50%);
}

.tool-menu .arco-menu:not(.arco-menu-collapsed)::before {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 48px;
  height: 48px;
  background-color: inherit;
  border-radius: 50%;
  box-shadow:
    -4px 0 2px var(--color-bg-2),
    0 0 1px rgba(0, 0, 0, 0.3);
  transform: translateX(50%);
}

.tool-menu .arco-menu.arco-menu-collapsed {
  width: 48px;
  height: 400px;
  padding-top: 24px;
  padding-bottom: 138px;
  border-radius: 22px;
}

.tool-menu .arco-menu.arco-menu-collapsed :deep(.arco-menu-collapse-button) {
  right: 8px;
  bottom: 8px;
}

.tool-menu .arco-menu:not(.arco-menu-collapsed) :deep(.arco-menu-inner) {
  padding-top: 28px;
}

:deep(.arco-menu-item[key='deleteSelected'].arco-menu-item-selected) {
  background-color: transparent !important;
}

/* canvas settings is now a menu item; remove absolute popover container */
/* canvas settings styles moved to header */
</style>
