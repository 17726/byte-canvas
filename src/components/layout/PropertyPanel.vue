<!-- 属性面板 -->

<template>
  <a-space direction="vertical" size="large">
    <!-- <a-input-number
    v-model="value"
    :style="{width:'320px'}"
    placeholder="Please Enter"
    class="input-demo"
    @change="fontSizeChange"
    :min="1" :max="100"/> -->
    <a-space>
      <a-color-picker  @change="fillColorChange" v-model="fillColor" defaultValue="#165DFF" showText disabledAlpha/>
      <a-color-picker  @change="borderColorChange" v-model="borderColor" defaultValue="#165DFF" showText disabledAlpha/>
  </a-space>
  </a-space>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
  const fillColor = ref('#ffccc7')
  const borderColor = ref('#ff4d4f')
  const canvasStore = useCanvasStore();
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
  const borderColorChange = (val: string) => {
    canvasStore.activeElements.forEach(element => {
      if (element && element.id) {
        canvasStore.updateNode(element.id, {
          style: {
            ...element.style,
            borderColor: val
          }
        });
      }
    });
  }
</script>
