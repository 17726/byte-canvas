<!-- 属性面板 -->

<template>
  <a-space direction="vertical" size="large">
    <a-space>
      <a-color-picker  @change="fillColorChange" v-model="fillColor" />
      <a-color-picker  @change="viceColorChange" v-model="viceColor" />
      <a-input-number value = "x" :disabled="!hasSelection" v-model="x" :style="{width:'80px'}" placeholder="X" class="input-demo"/>
      <a-input-number value = "y" :disabled="!hasSelection" v-model="y" :style="{width:'80px'}" placeholder="Y" class="input-demo"/>
      <a-button-group>
      <a-button @click="moveLayerUp" type="primary">上移</a-button>
      <a-button @click="moveLayerDown" type="primary">下移</a-button>
      <!-- TODO: 样式硬编码，以后可以提取为公共样式，并尽量用 UI 库原生的 props 或 theme 机制 -->
      <a-button @click="toggleFontBold" type="primary" style="background-color: white;color: black;border: 0;">B</a-button>
      <a-button @click="toggleFontStrikethrough" type="primary" style="background-color: white;color: black;border: 0;">S</a-button>
      <a-button @click="setFontItalic" type="primary" style="background-color: white;color: black;border: 0;">I</a-button>
      <a-button @click="toggleFontUnderline" type="primary" style="background-color: white;color: black;border: 0;">U</a-button>
      <a-input-number  @change="updateBorderWidth" v-model="activeStyleValue" :style="{width:'120px'}" placeholder="Please Enter" class="input-demo"/>
      </a-button-group>
    </a-space>
  </a-space>
</template>

<script setup lang="ts">
import { useCanvasStore } from '@/store/canvasStore'
import { computed, ref, watch } from 'vue'
const canvasStore = useCanvasStore()
  const fillColor = ref('#ffccc7')
  const viceColor = ref('#ff4d4f')
  const hasSelection = computed(() => canvasStore.activeElements.length > 0)
  const x = ref(0)
  const y = ref(0)
  const activeStyleValue = ref(16)
  const fillColorChange = (val: string) => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.style) {
        canvasStore.updateNode(element.id, {
          style: {
            ...element.style,
            backgroundColor: val
          }
        });
      }
    });
  }
  const viceColorChange = (val: string) => {
    // FIXME: 文本节点实际用 props.color/CSS 变量渲染，这里改 style 颜色无法改变文字颜色，需分支处理。
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.style) {
          canvasStore.updateNode(element.id, {
            style: {
              ...element.style,
              borderColor: val
            }
          });
      }
    });
  }
  const moveLayerUp = () => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id) {
        canvasStore.updateNode(element.id,{
          style:{
            ...element.style,
            zIndex:element.style.zIndex+1
          }
        });
      }
    });
  }
  const moveLayerDown = () => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id) {
        canvasStore.updateNode(element.id,{
          style:{
            ...element.style,
            zIndex:element.style.zIndex-1
          }
        })
      }
    })
  }
  const toggleFontBold = () => {
    console.log('字体加粗')
  }
  const toggleFontStrikethrough = () => {
    console.log('字体删除线')
  }
  const setFontItalic = () => {
    console.log('字体斜体')
  }
  const toggleFontUnderline = () => {
    console.log('字体下划线')
  }
  const updateBorderWidth = () => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id) {
        canvasStore.updateNode(element.id, {
          style: {
            ...element.style,
            borderWidth: activeStyleValue.value
          }
        });
      }
    });
  }
  // 监听选中元素变化，更新所有属性
  watch(() => canvasStore.activeElements, (newElements) => {
    if (newElements.length > 0) {
      const firstElement = newElements[0];
      if (firstElement) {
        // 更新坐标
        if (firstElement.transform) {
          x.value = firstElement.transform.x;
          y.value = firstElement.transform.y;
        }
        // 更新颜色
        if (firstElement.style) {
          // 设置填充色（背景色）
          if (firstElement.style.backgroundColor) {
            fillColor.value = firstElement.style.backgroundColor;
          }
          // 设置边框色或文字颜色
          if (firstElement.type === 'rect' || firstElement.type === 'circle') {
            // 形状元素使用边框色
            if (firstElement.style.borderColor) {
              viceColor.value = firstElement.style.borderColor;
            }
          } else {
            // 其他元素（如文本）使用文字颜色
            if (firstElement.style.color) {
              viceColor.value = firstElement.style.color;
            }
          }
          if(firstElement.style.borderWidth){
            activeStyleValue.value = firstElement.style.borderWidth;
          }
        }
      }
    }
  }, { immediate: true, deep: true })
  watch(x, (newX) => {
    // FIXME: 多选模式下，直接将所有元素的 X 坐标设为相同值，会导致元素重叠。
    // 建议：多选时应计算相对位移 (deltaX)，或者禁用坐标修改，或者明确这是“对齐”操作。
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.transform) {
        canvasStore.updateNode(element.id, {
          transform: {
            ...element.transform,
            x: newX
          }
        });
      }
    });
  });
  watch(y, (newY) => {
    // FIXME: 同上，多选模式下会导致元素重叠。
    canvasStore.activeElements.forEach(element => {
      if (element && element.id && element.transform) {
        canvasStore.updateNode(element.id, {
          transform: {
            ...element.transform,
            y: newY
          }
        });
      }
    });
  });
</script>
