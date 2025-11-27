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
      <a-sub-menu key="addGraphics" >
        <template #icon><icon-plus/></template>
        <template #title>图形</template>
        <!-- 创建矩形 -->
        <a-menu-item key="addRect">
          <template #icon><square/></template>
          矩形
        </a-menu-item>
        <!-- 创建圆形 -->
        <a-menu-item key="addCircle">
          <template #icon><round/></template>
          圆形
        </a-menu-item>
      </a-sub-menu>
      <!-- 文本创建按钮 -->
      <a-menu-item key="addText">
        <template #icon><icon-edit/></template>
        文本
      </a-menu-item>
      <!-- 照片创建按钮 -->
      <a-menu-item key="addImage">
        <template #icon><icon-image/></template>
        图片
      </a-menu-item>
      <!-- 元素删除按钮 -->
      <a-menu-item key="deleteSelected" :disabled="!hasSelection">
        <template #icon><icon-delete /></template>
        删除
      </a-menu-item>
    </a-menu>
  </div>

  <!-- 确认删除弹窗 -->
  <a-modal v-model:visible="delModalVisible" @ok="onDeleteConfirm" @cancel="delModalVisible = false">
    <template #title>确认删除</template>
    <div>确定要删除选中的元素吗？</div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconPlus, IconEdit, IconImage, IconDelete } from '@arco-design/web-vue/es/icon';
//TODO：UI开发完成后优化icon-park库的导入，针对按需导入减小打包体积
import { Square, Round } from '@icon-park/vue-next';
import { useCanvasStore } from '@/store/canvasStore';
import { ToolManager } from '@/core/tools/ToolManager';
import { Notification } from '@arco-design/web-vue';

//NOTE：按钮返回值需提前在MenuKey进行注册
enum MenuKey {
  AddRect   = 'addRect',
  AddCircle = 'addCircle',
  AddText   = 'addText',
  AddImage  = 'addImage',
  Delete    = 'deleteSelected',
}

const store = useCanvasStore();
const hasSelection = computed(() => store.activeElementIds.size > 0);

// 元素控制底层组件
const toolManager = new ToolManager();

// 高亮控制
const selectedKeys = ref<string[]>([]);

// 弹窗确认-弹窗开关
const delModalVisible = ref(false);

function onMenuItemClick(key: string) {
  switch (key) {
    case MenuKey.AddRect:
      console.log("矩形被点击");
      toolManager.createRect();
      selectedKeys.value = [key];
      break;
    case MenuKey.AddCircle:
      console.log("圆被点击");
      toolManager.createCircle();
      selectedKeys.value = [key];
      break;
    case MenuKey.AddText:
      console.log("文本被点击");
      toolManager.createText();
      selectedKeys.value = [key];
      break;
    case MenuKey.AddImage:
      console.log("照片被点击");
      //TODO：等待照片元素创建接口
      // toolManager.createImage();
      selectedKeys.value = [key];
      break;
    case MenuKey.Delete:
      if (!hasSelection.value) return;
      delModalVisible.value = true;
      break;
    default:
      console.warn(`未处理的菜单项: ${key}`);
      break;
  }
}

function onDeleteConfirm() {
  toolManager.deleteSelected();
  Notification.success({
    content: '删除成功！',
    closable: true,
    duration: 3000
  });
  selectedKeys.value = [];        // 清空选中状态
  delModalVisible.value = false;  // 关闭弹窗
}

</script>

<style scoped>
.tool-menu {
  width: 250px;
  height: 500px;
  padding: 40px;
  position: fixed;
  left:0;
  top: 80px;
  pointer-events: none;
  z-index:1002;
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
  box-shadow: -4px 0 2px var(--color-bg-2), 0 0 1px rgba(0, 0, 0, 0.3);
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

:deep(.arco-menu-item[key="deleteSelected"].arco-menu-item-selected) {
  background-color: transparent !important;
}

</style>
