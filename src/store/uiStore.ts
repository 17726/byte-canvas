import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * UI Store
 * 说明：这里保存 UI 状态（不建议持久化）如属性面板模式和折叠状态等。
 */
export const useUIStore = defineStore('ui', () => {
  // 面板模式：'node' | 'canvas'，选择不持久化
  const activePanel = ref<'node' | 'canvas'>('node');

  // 面板是否展开
  const isPanelExpanded = ref(false);

  function setActivePanel(panel: 'node' | 'canvas') {
    activePanel.value = panel;
  }

  function setPanelExpanded(expanded: boolean) {
    isPanelExpanded.value = expanded;
  }

  return {
    activePanel,
    isPanelExpanded,
    setActivePanel,
    setPanelExpanded,
  };
});
