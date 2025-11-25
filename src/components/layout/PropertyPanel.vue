<!-- 属性面板 -->

<template>
  <a-space direction="vertical" size="large">
    <a-space>
      <a-color-picker  @change="fillColorChange" v-model="fillColor" defaultValue="#165DFF" showText disabledAlpha/>
      <a-color-picker  @change="viceColorChange" v-model="borderColor" defaultValue="#165DFF" showText disabledAlpha/>
      <a-input-number value = "x" :disabled="!hasSelection" v-model="x" :style="{width:'80px'}" placeholder="X" class="input-demo"/>
      <a-input-number value = "y" :disabled="!hasSelection" v-model="y" :style="{width:'80px'}" placeholder="Y" class="input-demo"/>
      <a-button-group>
      <a-button @click="moveLayerUp" type="primary">上移</a-button>
      <a-button @click="moveLayerDown" type="primary">下移</a-button>
      </a-button-group>
    </a-space>
  </a-space>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCanvasStore } from '@/store/canvasStore'
const canvasStore = useCanvasStore()
  const fillColor = ref('#ffccc7')
  const borderColor = ref('#ff4d4f')
  const hasSelection = computed(() => canvasStore.activeElements.length > 0)
  const x = ref(0)
  const y = ref(0)

  // 监听选中元素变化，更新坐标输入框
  watch(() => canvasStore.activeElements, (newElements) => {
    if (newElements.length > 0) {
      const firstElement = newElements[0]
      if (firstElement && firstElement.transform) {
        x.value = firstElement.transform.x
        y.value = firstElement.transform.y
      }
    }
  },{ immediate: true, deep: true })
  const fillColorChange = (val: string) => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id) {
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
    canvasStore.activeElements.forEach(element => {
      if (element && element.id) {
        console.log(element)
        if(element.type === 'rect'){
          console.log(element.type)
          canvasStore.updateNode(element.id, {
          style: {
            ...element.style,
            borderColor: val
          }
        })
        }else{
          console.log(element.type)
          canvasStore.updateNode(element.id, {
          style: {
            ...element.style,
            color: val
          }
        })}
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
  watch(x, (newX) => {
    const activeElement = canvasStore.activeElements[0]
      if (activeElement && activeElement.id) {
        canvasStore.updateNode(activeElement.id, {
          transform: {
            ...activeElement.transform,
            x: newX
          }
        });
      };
  });

  // 监听y坐标变化，更新选中元素
  watch(y, (newY) => {
    const activeElement = canvasStore.activeElements[0]
      if (activeElement && activeElement.id) {
        canvasStore.updateNode(activeElement.id, {
          transform: {
            ...activeElement.transform,
            y: newY
          }
        });
      };
  });
</script>
