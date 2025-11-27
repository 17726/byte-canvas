<template>
    <div class="node-highlight-controls">
      <a-space v-if="isTextNode" class="control-item highlightStyle" :style="highlightStyle">
        <a-color-picker
          v-model="textColor"
          size="small"
          @change="updateNodeColor"
          title="文本颜色"
        />
         <a-button @click="toggleFontBold" type="primary" style="background-color: white;color: black;border: 0;">B</a-button>
      <a-button @click="toggleFontStrikethrough" type="primary" style="background-color: white;color: black;border: 0;">S</a-button>
      <a-button @click="setFontItalic" type="primary" style="background-color: white;color: black;border: 0;">I</a-button>
      <a-button @click="toggleFontUnderline" type="primary" style="background-color: white;color: black;border: 0;">U</a-button>
      <a-input-number @change="updateFontSize" v-model="fontSize" :style="{width:'100px',backgroundColor:'white',borderLeft:'1px solid black'}" placeholder="Please Enter" class="input-demo" :min="1"/>
      </a-space>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCanvasStore } from '@/store/canvasStore'
import { NodeType } from '@/types/state'
import type { TextState } from '@/types/state';
  const fontSize = ref(16);
  const canvasStore = useCanvasStore();
  const viewport = computed(() => canvasStore.viewport)
  const isDragging = computed(() => canvasStore.isInteracting);
  const textColor = ref('#000000');
  const activeNode = computed(() =>canvasStore.activeElements[0]);
  const isTextNode = computed(() =>activeNode.value?.type === NodeType.TEXT);
  const toggleFontBold = () => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.props) {
          canvasStore.updateNode(element.id, {
            props: {
              ...element.props,
              fontWeight: element.props.fontWeight === 'bold' ? 'normal' : 'bold'
            }
          });
      }
    });
  }
  const toggleFontStrikethrough = () => {
    console.log('字体删除线')
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.props) {
          canvasStore.updateNode(element.id, {
            props: {
              ...element.props,
              textDecorationLine: element.props.textDecorationLine === 'line-through' ? 'none' : 'line-through'
            }
          });
      }
    });
  }
  const setFontItalic = () => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.props) {
          canvasStore.updateNode(element.id, {
            props: {
              ...element.props,
              fontStyle: element.props.fontStyle === 'italic' ? 'normal' : 'italic'
            }
          });
      }
    });
  }
  const toggleFontUnderline = () => {
    
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.props) {
          canvasStore.updateNode(element.id, {
            props: {
              ...element.props,
              textDecorationLine: element.props.textDecorationLine === 'underline' ? 'none' : 'underline'
            }
          });
      }
    });
  }
  const updateFontSize = (size: number) => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.props) {
          canvasStore.updateNode(element.id, {
            props: {
              ...element.props,
              fontSize: size
            }
          });
      }
    });
  }
// 监听活动节点变化，更新文本颜色
  watch(activeNode, (newNode) => {
    if (newNode && newNode.type === NodeType.TEXT && 'props' in newNode) {
      const textNode = newNode as TextState;
      if (textNode.props && textNode.props.color) {
        textColor.value = textNode.props.color;
      }
      if (textNode.props.fontSize) {
        fontSize.value = textNode.props.fontSize; // 将节点的fontSize同步到输入框
      }
    }
  }, { immediate: true, deep: true });
  // 计算颜色选择器的位置样式
  const highlightStyle = computed(() => {
    const baseStyle = {
      backgroundColor: 'white',
      position: 'absolute' as const,
      zIndex: 1000,
      pointerEvents: 'all' as const,
      transform: 'translateX(-50%)' as const,
      transition: isDragging.value ? 'none' : 'all 0.2s ease' as const
    };

    if (!activeNode.value || !activeNode.value.transform) {
      return { ...baseStyle, left: '0px', top: '0px' };
    }

  const { x: worldX, y: worldY } = activeNode.value.transform;
  const { zoom, offsetX, offsetY } = viewport.value;
  // 关键：将节点的世界坐标转换为屏幕坐标
  // 公式：屏幕坐标 = 世界坐标 * 缩放比例 + 画布平移偏移
  const screenX = worldX * zoom + offsetX;
  const screenY = worldY * zoom + offsetY;
  const offsetLeft = 40; // 向左移动10px（可根据需求调整）
  const offsetTop = -40;  // 向上移动30px（可根据需求调整）
  return {
    ...baseStyle,
    left: `${screenX + offsetLeft}px`,  // 使用转换后的屏幕X坐标
    top: `${screenY + offsetTop}px`   // 使用转换后的屏幕Y坐标
  };
});
const updateNodeColor = (color: string) => {
  console.log('565')
  const node = activeNode.value;
  if (node && node.id && node.type === NodeType.TEXT && 'props' in node) {
    const textNode = node as TextState;
    if (textNode.props) {
      console.log('准备更新颜色：', color); // 1. 确认颜色值正确
      canvasStore.updateNode(textNode.id, {
        props: {
          ...textNode.props,
          color: color.trim()
        }
      });
      // 2. 立即检查节点数据是否已更新（如果 store 是响应式的）
      setTimeout(() => {
        const updatedNode = canvasStore.activeElements[0] as TextState;
        console.log('更新后的值：', updatedNode?.props?.color);
      }, 0);
    }
  }
};
</script>

<style scoped>
.node-highlight-controls {
  background-color: white;
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
/* 单个控件项的样式 */
.control-item {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
