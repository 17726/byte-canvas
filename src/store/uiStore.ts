/**
 * @file uiStore.ts
 * @description UI Store - 用户界面状态管理
 *
 * 职责：
 * 1. 管理属性面板的显示模式（node/canvas）
 * 2. 管理面板的展开/折叠状态
 *
 * 特点：
 * - 不持久化：UI 状态仅在当前会话有效，刷新后重置
 * - 轻量级：仅包含必要的 UI 控制状态（区别于 canvasStore 的业务状态）
 * - 响应式：使用 Pinia ref 实现响应式状态管理
 *
 * 包含状态：
 * - activePanel: 当前激活的面板模式（'node' | 'canvas'）
 * - isPanelExpanded: 面板是否展开
 *
 * 包含方法：
 * - setActivePanel: 设置当前激活的面板模式
 * - setPanelExpanded: 设置面板展开状态
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * UI Store
 *
 * 管理用户界面相关的瞬态状态（不持久化）
 */
export const useUIStore = defineStore('ui', () => {
  // 面板模式：'node' | 'canvas'，选择不持久化
  const activePanel = ref<'node' | 'canvas'>('node');

  // 面板是否展开
  const isPanelExpanded = ref(false);

  /**
   * 设置当前激活的面板模式
   *
   * @param panel - 面板模式，'node' 表示节点属性面板，'canvas' 表示画布属性面板
   */
  function setActivePanel(panel: 'node' | 'canvas') {
    activePanel.value = panel;
  }

  /**
   * 设置面板展开状态
   *
   * @param expanded - true 表示展开，false 表示折叠
   */
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
