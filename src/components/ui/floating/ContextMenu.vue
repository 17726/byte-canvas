<template>
  <teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="right-click-menu"
      :style="menuStyle"
      @contextmenu.prevent
    >
      <!-- 画布右键菜单 -->
      <div v-if="!hasSelection">
        <a-menu mode="pop" style="min-width: 180px">
          <a-menu-item key="paste" v-if="isClipboardAvailable" @click="paste">
            <template #icon><icon-paste /></template>
            粘贴
            <span class="label">Ctrl+V</span>
          </a-menu-item>
          <a-menu-item key="selectAll" @click="selectAll">
            <template #icon><FullSelection /></template>
            全选
            <span class="label">Ctrl+A</span>
          </a-menu-item>
          <a-menu-item key="clearCanvas" @click="clearModalVisible = true">
            <template #icon><IconDelete /></template>
            清空画布
          </a-menu-item>
        </a-menu>
      </div>

      <!-- 元素右键菜单 -->
      <div v-else>
        <a-menu mode="pop" style="min-width: 180px">
          <a-button-group>
            <a-button
              type="text"
              class="shortcut-button"
              :disabled="!hasSelection"
              key="copy"
              title="复制"
              @click="copy"
            >
              <template #icon><icon-copy /></template>
            </a-button>
            <a-button
              type="text"
              class="shortcut-button"
              :disabled="!isClipboardAvailable"
              key="paste"
              title="粘贴"
              @click="paste"
            >
              <template #icon><icon-paste /></template>
            </a-button>
            <a-button
              type="text"
              class="shortcut-button"
              :disabled="!hasSelection"
              key="cut"
              title="剪切"
              @click="cut"
            >
              <template #icon><icon-scissor /></template>
            </a-button>
            <a-button
              type="text"
              class="shortcut-button"
              :disabled="!hasSelection"
              key="delete"
              title="删除"
              @click="delModalVisible = true"
            >
              <template #icon><icon-delete /></template>
            </a-button>
          </a-button-group>

          <a-divider margin="5px" />

          <a-menu-item key="selectAll" @click="selectAll">
            <template #icon><FullSelection /></template>
            全选
            <span class="label">Ctrl+A</span>
          </a-menu-item>

          <a-divider margin="5px" />

          <a-sub-menu key="sort" title="图层" :disabled="!hasSelection">
            <template #icon><icon-layers /></template>
            <a-menu-item key="moveToFront" @click="bringToFront">
              <template #icon><MinusTheTop /></template>
              置于顶层
            </a-menu-item>
            <a-menu-item key="moveToBack" @click="sendToBack">
              <template #icon><MinusTheBottom /></template>
              置于底层
            </a-menu-item>
          </a-sub-menu>

          <a-sub-menu key="grouping" title="组合" :disabled="!hasSelection">
            <template #icon><GraphicStitchingFour /></template>
            <a-menu-item key="group" @click="groupSelected">
              <template #icon><Group /></template>
              组合
              <span class="label">Ctrl+G</span>
            </a-menu-item>
            <a-menu-item key="ungroup" @click="ungroupSelected">
              <template #icon><Ungroup /></template>
              取消组合
              <span class="label">Ctrl+Shift+G</span>
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
      </div>
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

  <!-- 画布清空确认弹窗 -->
  <a-modal
    v-model:visible="clearModalVisible"
    @ok="confirmClear"
    @cancel="clearModalVisible = false"
  >
    <template #title>确认清空</template>
    <div>您确定要清空整个画布吗？所有内容将被永久删除，且无法恢复！</div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useNodeActions } from '@/composables/useNodeActions';
import {
  IconCopy,
  IconPaste,
  IconScissor,
  IconDelete,
  IconLayers,
} from '@arco-design/web-vue/es/icon';
import {
  MinusTheTop,
  MinusTheBottom,
  GraphicStitchingFour,
  Group,
  Ungroup,
  FullSelection,
} from '@icon-park/vue-next';
import { loadClipboard } from '@/store/persistence.ts';

const {
  hasSelection,
  copy,
  cut,
  paste,
  deleteSelected,
  groupSelected,
  ungroupSelected,
  bringToFront,
  sendToBack,
  selectAll,
  clearCanvas,
} = useNodeActions();

// 监听来自 ToolManager 的右键菜单事件
function handleShowContextMenu(e: CustomEvent) {
  const { x, y } = e.detail;
  openAt(x, y);
  // 检测粘贴板可用性
  checkClipboardAvailability();
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
const menuRef = ref<HTMLDivElement | null>(null);
const delModalVisible = ref(false);
const clearModalVisible = ref(false);
const isClipboardAvailable = ref(false);

/* ---------- 计算属性 ---------- */
const menuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  zIndex: 9999,
}));

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

/* ---------- 删除确认 ---------- */
function onDeleteConfirm() {
  deleteSelected();
  delModalVisible.value = false;
}

/* ---------- 清空画布确认 ---------- */
function confirmClear() {
  clearCanvas();
  clearModalVisible.value = false;
}

/* ---------- 检测粘贴板可用性 ---------- */
function checkClipboardAvailability() {
  const clipboardData = loadClipboard();
  // 确保赋值前进行类型检查，避免null值导致的类型错误
  if (clipboardData && clipboardData.nodes && Array.isArray(clipboardData.nodes)) {
    isClipboardAvailable.value = clipboardData.nodes.length > 0;
  } else {
    isClipboardAvailable.value = false;
  }
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
  min-width: 180px;
  user-select: none;
  position: fixed;
  z-index: 1001;
}

.label {
  color: #ffffff;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 8px;
  border-radius: 5px;
  float: right;
  display: flex;
  align-items: center;
  height: 1.4em;
  line-height: 1.4;
  margin-top: 10px;
  margin-bottom: 10px;
  margin-left: 10px;
}

.shortcut-button {
  height: 40px;
  width: 40px;
}
</style>
