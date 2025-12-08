<template>
  <div class="performance-test-panel">
    <div class="panel-header">
      <h3>性能测试工具</h3>
      <a-button size="small" @click="togglePanel">{{ isExpanded ? '收起' : '展开' }}</a-button>
    </div>

    <div v-if="isExpanded" class="panel-content">
      <!-- FPS 显示 -->
      <div class="fps-display">
        <div class="fps-value" :class="{ 'fps-good': fps >= 50, 'fps-bad': fps < 50 }">
          FPS: {{ fps.toFixed(1) }}
        </div>
        <div class="fps-status" :class="{ 'status-good': fps >= 50, 'status-bad': fps < 50 }">
          {{ fps >= 50 ? '✓ 达标' : '✗ 未达标' }}
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">元素数量:</span>
          <span class="stat-value">{{ elementCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平均帧时间:</span>
          <span class="stat-value">{{ avgFrameTime.toFixed(2) }}ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最低FPS:</span>
          <span class="stat-value">{{ minFps.toFixed(1) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最高FPS:</span>
          <span class="stat-value">{{ maxFps.toFixed(1) }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <a-button type="primary" @click="create100Elements" :loading="isCreating">
          创建100个元素
        </a-button>
        <a-button @click="clearAllElements" :disabled="elementCount === 0"> 清空所有元素 </a-button>
        <a-button @click="startAutoAnimation" :disabled="elementCount === 0 || isAnimating">
          开始自动动画
        </a-button>
        <a-button @click="stopAutoAnimation" :disabled="!isAnimating"> 停止动画 </a-button>
        <a-button @click="resetStats">重置统计</a-button>
      </div>

      <!-- 动画设置 -->
      <div class="animation-settings">
        <div class="setting-item">
          <label>动画速度:</label>
          <a-slider
            v-model="animationSpeed"
            :min="0.1"
            :max="5"
            :step="0.1"
            :disabled="!isAnimating"
          />
          <span class="setting-value">{{ animationSpeed.toFixed(1) }}x</span>
        </div>
        <div class="setting-item">
          <label>动画类型:</label>
          <a-select v-model="animationType" :disabled="isAnimating" size="small">
            <a-option value="drag">拖拽移动</a-option>
            <a-option value="scale">缩放</a-option>
            <a-option value="rotate">旋转</a-option>
            <a-option value="mixed">混合动画</a-option>
          </a-select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeFactory } from '@/core/services/NodeFactory';
import { NodeType } from '@/types/state';

const store = useCanvasStore();

// 面板状态
const isExpanded = ref(true);

// FPS 监控
const fps = ref(60);
const avgFrameTime = ref(16.67);
const minFps = ref(60);
const maxFps = ref(60);
const frameCount = ref(0);
const lastTime = ref(performance.now());
const frameTimes: number[] = [];
const MAX_FRAME_SAMPLES = 60;

// 动画状态
const isAnimating = ref(false);
const animationSpeed = ref(1);
const animationType = ref<'drag' | 'scale' | 'rotate' | 'mixed'>('mixed');
let animationFrameId: number | null = null;
let fpsFrameId: number | null = null;
let animationStartTime = 0;

// 元素计数
const elementCount = computed(() => store.nodeOrder.length);

// 是否正在创建元素
const isCreating = ref(false);

// FPS 计算
const calculateFPS = () => {
  const now = performance.now();
  const delta = now - lastTime.value;
  lastTime.value = now;

  if (delta > 0) {
    const currentFps = 1000 / delta;
    frameTimes.push(currentFps);
    if (frameTimes.length > MAX_FRAME_SAMPLES) {
      frameTimes.shift();
    }

    // 计算平均FPS
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    fps.value = avg;
    avgFrameTime.value = 1000 / avg;

    // 更新最小/最大FPS
    minFps.value = Math.min(minFps.value, currentFps);
    maxFps.value = Math.max(maxFps.value, currentFps);
  }

  fpsFrameId = requestAnimationFrame(calculateFPS);
};

// 创建100个元素
const create100Elements = async () => {
  isCreating.value = true;
  const nodeIds: string[] = [];

  try {
    // 清空现有元素
    if (store.nodeOrder.length > 0) {
      store.deleteNodes([...store.nodeOrder]);
    }

    // 计算布局：10x10网格
    const cols = 10;
    const rows = 10;
    const spacing = 120;
    const startX = 100;
    const startY = 100;

    // 批量创建元素
    for (let i = 0; i < 100; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * spacing;
      const y = startY + row * spacing;

      // 随机选择元素类型
      const type = Math.random();
      let node;
      if (type < 0.4) {
        node = NodeFactory.createRect(x, y);
      } else if (type < 0.7) {
        node = NodeFactory.createCircle(x, y);
      } else if (type < 0.9) {
        node = NodeFactory.createText(x, y);
      } else {
        // 图片节点需要异步创建
        node = await NodeFactory.createImage(undefined, x, y);
      }

      store.addNode(node);
      nodeIds.push(node.id);

      // 每10个元素后让出控制权，避免阻塞UI
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // 选中所有元素
    store.setActive(nodeIds);
    console.log(`✅ 成功创建 ${nodeIds.length} 个元素`);
  } catch (error) {
    console.error('创建元素失败:', error);
  } finally {
    isCreating.value = false;
  }
};

// 清空所有元素
const clearAllElements = () => {
  if (store.nodeOrder.length > 0) {
    store.deleteNodes([...store.nodeOrder]);
  }
  stopAutoAnimation();
};

// 自动动画
const animateElements = () => {
  if (!isAnimating.value) return;

  const now = performance.now();
  if (animationStartTime === 0) {
    animationStartTime = now;
  }

  const elapsed = (now - animationStartTime) * animationSpeed.value * 0.001;
  const nodes = store.activeElements;

  if (nodes.length === 0) {
    animationFrameId = requestAnimationFrame(animateElements);
    return;
  }

  nodes.forEach((node, index) => {
    if (!node) return;

    const phase = (elapsed + index * 0.1) % (Math.PI * 2);
    const baseX = 400 + Math.cos(phase) * 200;
    const baseY = 400 + Math.sin(phase) * 200;

    let updates: Partial<typeof node.transform> = {};

    switch (animationType.value) {
      case 'drag':
        updates = {
          x: baseX,
          y: baseY,
        };
        break;

      case 'scale':
        const scale = 0.5 + Math.sin(phase) * 0.5;
        updates = {
          width: 100 * scale,
          height: 100 * scale,
        };
        break;

      case 'rotate':
        updates = {
          rotation: (phase * 180) / Math.PI,
        };
        break;

      case 'mixed':
        const mixedScale = 0.7 + Math.sin(phase) * 0.3;
        updates = {
          x: baseX,
          y: baseY,
          width: 100 * mixedScale,
          height: 100 * mixedScale,
          rotation: (phase * 180) / Math.PI,
        };
        break;
    }

    store.updateNode(node.id, {
      transform: {
        ...node.transform,
        ...updates,
      },
    });
  });

  animationFrameId = requestAnimationFrame(animateElements);
};

// 开始自动动画
const startAutoAnimation = () => {
  if (store.activeElements.length === 0) {
    // 如果没有选中元素，选中所有元素
    store.setActive([...store.nodeOrder]);
  }

  // 设置交互状态，避免频繁触发历史记录快照
  store.isInteracting = true;
  isAnimating.value = true;
  animationStartTime = 0;
  animateElements();
};

// 停止自动动画
const stopAutoAnimation = () => {
  isAnimating.value = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  // 恢复交互状态，允许历史记录
  store.isInteracting = false;
};

// 重置统计
const resetStats = () => {
  fps.value = 60;
  avgFrameTime.value = 16.67;
  minFps.value = 60;
  maxFps.value = 60;
  frameTimes.length = 0;
  lastTime.value = performance.now();
};

// 切换面板
const togglePanel = () => {
  isExpanded.value = !isExpanded.value;
};

// 监听元素数量变化，自动停止动画
watch(
  () => store.nodeOrder.length,
  (newCount) => {
    if (newCount === 0 && isAnimating.value) {
      stopAutoAnimation();
    }
  }
);

// 生命周期
onMounted(() => {
  calculateFPS();
});

onUnmounted(() => {
  stopAutoAnimation();
  if (fpsFrameId !== null) {
    cancelAnimationFrame(fpsFrameId);
  }
});
</script>

<style scoped>
.performance-test-panel {
  position: fixed;
  top: 60px;
  left: 10px;
  width: 320px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: calc(100vh - 80px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-1);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.fps-display {
  background: var(--color-bg-1);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  margin-bottom: 16px;
}

.fps-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--color-text-1);
}

.fps-value.fps-good {
  color: #00b42a;
}

.fps-value.fps-bad {
  color: #f53f3f;
}

.fps-status {
  font-size: 14px;
  font-weight: 500;
}

.fps-status.status-good {
  color: #00b42a;
}

.fps-status.status-bad {
  color: #f53f3f;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-2);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.actions .arco-btn {
  width: 100%;
}

.animation-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item label {
  font-size: 12px;
  color: var(--color-text-2);
  font-weight: 500;
}

.setting-value {
  font-size: 12px;
  color: var(--color-text-1);
  text-align: right;
  margin-top: -20px;
  margin-bottom: 8px;
}
</style>
