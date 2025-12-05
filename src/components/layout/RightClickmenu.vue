<template>
  <teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="right-click-menu"
      :style="menuStyle"
      @contextmenu.prevent
    >
      <a-menu mode="vertical" @menu-item-click="RightMenuItemClick" style="min-width: 200px">
        <a-menu-item :disabled="!hasSelection" key="copy">复制</a-menu-item>
        <a-menu-item key="paste">粘贴</a-menu-item>
        <a-menu-item :disabled="!hasSelection" key="cut">剪切</a-menu-item>
        <a-menu-item :disabled="!hasSelection" key="delete">删除</a-menu-item>

        <a-sub-menu key="sort" title="排序" :disabled="!hasSelection">
          <a-menu-item key="moveToFront">置于顶层</a-menu-item>
          <a-menu-item key="moveToBack">置于底层</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="grouping" title="组合" :disabled="!hasSelection">
          <a-menu-item key="group">组合</a-menu-item>
          <a-menu-item key="ungroup">取消组合</a-menu-item>
        </a-sub-menu>

        <a-divider margin="5px" />

        <a-menu-item key="selectAll">全选</a-menu-item>
        <a-menu-item key="clearSelection">取消选择</a-menu-item>
      </a-menu>
    </div>
  </teleport>

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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { Notification } from '@arco-design/web-vue';

const store = useCanvasStore();

// 监听来自 ToolManager 的右键菜单事件
function handleShowContextMenu(e: CustomEvent) {
  const { x, y } = e.detail;
  openAt(x, y);
}

// 监听全局点击事件，用于关闭菜单
function handleGlobalClick(e: Event) {
  if (visible.value && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    close();
  }
}

// 监听键盘事件，用于 ESC 键关闭菜单
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) close();
}

/* ---------- 状态 ---------- */
const pos = ref({ x: 0, y: 0 });
const visible = ref(false);
const menuRef = ref<HTMLDivElement | null>(null); // ← 唯一改动：精确类型
const delModalVisible = ref(false);

/* ---------- 计算属性 ---------- */
const menuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  zIndex: 9999,
}));

const hasSelection = computed(() => store.activeElementIds.size > 0);

/* ---------- 菜单枚举 ---------- */
//NOTE：枚举值与菜单项 key 保持一致，使用前注册
enum MenuKey {
  Copy = 'copy',
  Paste = 'paste',
  Cut = 'cut',
  Delete = 'delete',
  MoveToFront = 'moveToFront',
  MoveToBack = 'moveToBack',
  Group = 'group',
  Ungroup = 'ungroup',
  SelectAll = 'selectAll',
  ClearSelection = 'clearSelection',
}

/* ---------- 菜单点击处理 ---------- */
function RightMenuItemClick(key: string) {
  switch (key) {
    case MenuKey.Copy:
      if (!hasSelection.value) return;
      store.copySelected();
      Notification.success({ content: '已复制到剪贴板', closable: true, duration: 2000 });
      break;
    case MenuKey.Paste:
      store.paste();
      Notification.success({ content: '粘贴成功', closable: true, duration: 2000 });
      break;
    case MenuKey.Cut:
      if (!hasSelection.value) return;
      store.cutSelected();
      Notification.success({ content: '已剪切到剪贴板', closable: true, duration: 2000 });
      break;
    case MenuKey.Delete:
      if (!hasSelection.value) return;
      delModalVisible.value = true;
      break;
    case MenuKey.MoveToFront:
      //TODO：待MoveToFront方法实现
      if (!hasSelection.value) return;
      Notification.success({ content: '已置于顶层', closable: true, duration: 2000 });
      break;
    case MenuKey.MoveToBack:
      //TODO：待MoveToBack方法实现
      if (!hasSelection.value) return;
      Notification.success({ content: '已置于底层', closable: true, duration: 2000 });
      break;
    case MenuKey.Group:
      //TODO：待Group方法实现
      if (!hasSelection.value || store.activeElementIds.size < 2) {
        Notification.warning({
          content: '至少需要选择两个元素才能进行组合',
          closable: true,
          duration: 2000,
        });
        return;
      }
      Notification.success({ content: '已组合选中元素', closable: true, duration: 2000 });
      break;
    case MenuKey.Ungroup:
      //TODO：待Ungroup方法实现
      if (!hasSelection.value) return;
      Notification.success({ content: '已取消组合', closable: true, duration: 2000 });
      break;
    case MenuKey.SelectAll:
      // Select all non-locked nodes
      const allNodeIds = store.nodeOrder.filter(id => {
        const node = store.nodes[id];
        return node && !node.isLocked;
      });
      store.setActive(allNodeIds);
      Notification.success({ content: '已全选', closable: true, duration: 2000 });
      break;
    case MenuKey.ClearSelection:
      store.setActive([]);
      Notification.success({ content: '已取消选择', closable: true, duration: 2000 });
      break;
    default:
      console.warn(`未处理的菜单项: ${key}`);
  }
  close();
}

/* ---------- 删除确认 ---------- */
function onDeleteConfirm() {
  store.activeElementIds.forEach((id) => store.deleteNode(id));
  Notification.success({ content: '删除成功！', closable: true, duration: 3000 });
  delModalVisible.value = false;
}

/* ---------- 打开/关闭 ---------- */
function openAt(clientX: number, clientY: number) {
  pos.value = { x: clientX, y: clientY };
  visible.value = true;
  nextTick(() => {
    const menu = menuRef.value;
    if (!menu) return;
    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();
    if (pos.value.x + rect.width > innerWidth)
      pos.value.x = Math.max(8, innerWidth - rect.width - 8);
    if (pos.value.y + rect.height > innerHeight)
      pos.value.y = Math.max(8, innerHeight - rect.height - 8);
  });
}

function close() {
  visible.value = false;
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  document.addEventListener('showContextMenu', handleShowContextMenu as EventListener);
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('showContextMenu', handleShowContextMenu as EventListener);
  document.removeEventListener('click', handleGlobalClick);
  document.removeEventListener('keydown', handleKeyDown);
});

/* ---------- 暴露供父组件调用 ---------- */
defineExpose({ openAt, close, visible });
</script>

<style scoped>
.right-click-menu {
  background: var(--color-bg-1, #fff);
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(20, 23, 28, 0.12);
  padding: 6px 0;
  min-width: 200px;
  user-select: none;
  position: fixed;
  z-index: 1001;
}
</style>
