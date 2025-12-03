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

  <!-- 确认删除弹窗 -->
  <a-modal
    v-model:visible="delModalVisible"
    @ok="onDeleteConfirm"
    @cancel="delModalVisible = false"
  >
    <template #title>确认删除</template>
    <div>确定要删除选中的元素吗？</div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconPlus, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';
//TODO：UI开发完成后优化icon-park库的导入，针对按需导入减小打包体积
import { Square, Round } from '@icon-park/vue-next';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeFactory } from '@/core/services/NodeFactory';
import { Notification } from '@arco-design/web-vue';
import ImageMenu from './ImageMenu.vue';

//NOTE：按钮返回值需提前在MenuKey进行注册
enum MenuKey {
  AddRect = 'addRect',
  AddCircle = 'addCircle',
  AddText = 'addText',
  AddImage = 'addImage',
  Delete = 'deleteSelected',
}

const store = useCanvasStore();
const hasSelection = computed(() => store.activeElementIds.size > 0);

// 高亮控制
const selectedKeys = ref<string[]>([]);

// 弹窗确认-弹窗开关
const delModalVisible = ref(false);

function onMenuItemClick(key: string) {
  switch (key) {
    case MenuKey.AddRect:
      console.log('矩形被点击');
      {
        const node = NodeFactory.createRect();
        store.addNode(node);
        store.setActive([node.id]);
      }
      selectedKeys.value = [key];
      break;
    case MenuKey.AddCircle:
      console.log('圆被点击');
      {
        const node = NodeFactory.createCircle();
        store.addNode(node);
        store.setActive([node.id]);
      }
      selectedKeys.value = [key];
      break;
    case MenuKey.AddText:
      console.log('文本被点击');
      {
        const node = NodeFactory.createText();
        store.addNode(node);
        store.setActive([node.id]);
      }
      selectedKeys.value = [key];
      break;
    //NOTE: 菜单项不支持预览图 故创建图片独立出去处理(ImageMenu.vue)
    // case MenuKey.AddImage:
    //   console.log('图片被点击');
    //   toolManager.createImage(imageUrl);
    //   selectedKeys.value = [key];
    //   break;
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
  // 直接调用 store 删除选中节点
  store.activeElementIds.forEach((id) => {
    store.deleteNode(id);
  });
  Notification.success({
    content: '删除成功！',
    closable: true,
    duration: 3000,
  });
  selectedKeys.value = []; // 清空选中状态
  delModalVisible.value = false; // 关闭弹窗
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
