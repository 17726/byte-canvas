/**
 * @file useStyleSync.ts
 * @description 属性同步 Composable - 统一节点属性的双向绑定逻辑
 *
 * 职责：
 * 1. 提供单选节点的双向绑定属性
 * 2. 统一属性读取和更新逻辑
 * 3. 支持变换、外观、文本、形状等多种属性
 * 4. 空值安全处理
 *
 * 特点：
 * - 返回 WritableComputedRef，可直接用于 v-model
 * - 自动处理 activeNode 为空的情况
 * - 集中管理所有节点属性的读写逻辑
 * - DRY 原则：避免在多个组件中重复定义
 *
 * 包含属性绑定：
 * - Transform: x, y, width, height, rotation
 * - Appearance: opacity, fillColor, strokeColor, strokeWidth
 * - Text: fontSize, fontFamily, fontWeight, textColor, textContent
 * - Shape: cornerRadius
 *
 * 包含辅助状态：
 * - activeNode: 当前选中的单个节点
 * - isSingleSelection: 是否单选
 * - isShape,isRect, isCircle, isText, isImage, isGroup: 节点类型判断
 */

import { computed, type WritableComputedRef } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type NodeState, type ShapeState, type TextState } from '@/types/state';
import { GroupService } from '@/core/services/GroupService';

export function useStyleSync() {
  const store = useCanvasStore();

  // ==================== 核心状态 ====================

  /**
   * 当前选中的单个节点（仅在单选时返回）
   */
  const activeNode = computed<NodeState | null>(() => {
    const ids = Array.from(store.activeElementIds);
    if (ids.length !== 1) return null;
    const id = ids[0]!;
    return store.nodes[id] || null;
  });

  /**
   * 是否为单选状态
   */
  const isSingleSelection = computed(() => store.activeElementIds.size === 1);

  // ==================== 节点类型判断 ====================

  const isShape = computed(
    () => activeNode.value?.type === NodeType.RECT || activeNode.value?.type === NodeType.CIRCLE
  );

  // 单独区分矩形/圆形，用于处理类型特有属性（例如 rect 的 cornerRadius）
  const isRect = computed(() => activeNode.value?.type === NodeType.RECT);
  const isCircle = computed(() => activeNode.value?.type === NodeType.CIRCLE);

  const isText = computed(() => activeNode.value?.type === NodeType.TEXT);

  const isImage = computed(() => activeNode.value?.type === NodeType.IMAGE);

  const isGroup = computed(() => activeNode.value?.type === NodeType.GROUP);

  // ==================== 绑定工厂函数 ====================

  /**
   * 创建双向绑定的计算属性
   * @param getter 获取属性值的函数
   * @param setter 更新属性的函数，接收新值并返回更新对象
   * @param defaultValue 默认值
   */
  function createBinding<T>(
    getter: (node: NodeState) => T,
    setter: (node: NodeState, value: T) => Partial<NodeState>,
    defaultValue: T
  ): WritableComputedRef<T> {
    return computed({
      get: () => {
        if (!activeNode.value) return defaultValue;
        return getter(activeNode.value);
      },
      set: (value: T) => {
        if (!activeNode.value) return;
        const node = activeNode.value;
        const patch = setter(node, value);

        // 智能分发：判断是否为 Group 节点且涉及 transform/style 更新
        if (node.type === NodeType.GROUP) {
          if ('transform' in patch && patch.transform) {
            // Group 的 transform 更新 -> 调用 GroupService
            GroupService.updateGroupTransform(store, node.id, patch.transform);
          } else if ('style' in patch && patch.style) {
            // Group 的 style 更新 -> 调用 GroupService
            GroupService.updateGroupStyle(store, node.id, patch.style);
          } else {
            // 其他属性更新（如 props）
            store.updateNode(node.id, patch);
          }
        } else {
          // 普通节点：直接使用 updateNode
          store.updateNode(node.id, patch);
        }
      },
    });
  }

  // ==================== Transform 属性 ====================

  const x = createBinding<number>(
    (node) => node.transform.x,
    (node, value) => ({ transform: { ...node.transform, x: value } }),
    0
  );

  const y = createBinding<number>(
    (node) => node.transform.y,
    (node, value) => ({ transform: { ...node.transform, y: value } }),
    0
  );

  const width = createBinding<number>(
    (node) => node.transform.width,
    (node, value) => ({ transform: { ...node.transform, width: value } }),
    100
  );

  const height = createBinding<number>(
    (node) => node.transform.height,
    (node, value) => ({ transform: { ...node.transform, height: value } }),
    100
  );

  const rotation = createBinding<number>(
    (node) => node.transform.rotation,
    (node, value) => ({ transform: { ...node.transform, rotation: value } }),
    0
  );

  // ==================== Appearance 属性 ====================

  const opacity = createBinding<number>(
    (node) => node.style.opacity ?? 1,
    (node, value) => ({ style: { ...node.style, opacity: value } }),
    1
  );

  const fillColor = createBinding<string>(
    (node) => {
      if (node.type === NodeType.RECT || node.type === NodeType.CIRCLE) {
        return (node as ShapeState).style.backgroundColor || '#ffffff';
      }
      // 对于文本和图片节点，也返回它们的背景色（而不是固定返回白色）
      return node.style?.backgroundColor || '#ffffff';
    },
    (node, value) => {
      // 只对矩形和圆形节点应用填充色
      if (node.type === NodeType.RECT || node.type === NodeType.CIRCLE) {
        return { style: { ...node.style, backgroundColor: value } };
      }
      // 对于其他节点类型，不做任何修改
      return {};
    },
    '#ffffff'
  );

  const strokeColor = createBinding<string>(
    (node) => {
      if (node.type === NodeType.RECT || node.type === NodeType.CIRCLE) {
        return (node as ShapeState).style.borderColor || '#000000';
      }
      return '#000000';
    },
    (node, value) => ({ style: { ...node.style, borderColor: value } }),
    '#000000'
  );

  const strokeWidth = createBinding<number>(
    (node) => {
      if (node.type === NodeType.RECT || node.type === NodeType.CIRCLE) {
        return (node as ShapeState).style.borderWidth || 0;
      }
      return 0;
    },
    (node, value) => ({ style: { ...node.style, borderWidth: value } }),
    0
  );

  // ==================== Text 属性 ====================

  const fontSize = createBinding<number>(
    (node) => {
      if (node.type === NodeType.TEXT) {
        return (node as TextState).props.fontSize || 16;
      }
      return 16;
    },
    (node, value) => {
      if (node.type === NodeType.TEXT) {
        return { props: { ...(node as TextState).props, fontSize: value } } as Partial<TextState>;
      }
      return {};
    },
    16
  );

  const fontFamily = createBinding<string>(
    (node) => {
      if (node.type === NodeType.TEXT) {
        return (node as TextState).props.fontFamily || 'Arial';
      }
      return 'Arial';
    },
    (node, value) => {
      if (node.type === NodeType.TEXT) {
        return { props: { ...(node as TextState).props, fontFamily: value } } as Partial<TextState>;
      }
      return {};
    },
    'Arial'
  );

  const fontWeight = createBinding<number | string>(
    (node) => {
      if (node.type === NodeType.TEXT) {
        return (node as TextState).props.fontWeight || 400;
      }
      return 400;
    },
    (node, value) => {
      if (node.type === NodeType.TEXT) {
        return { props: { ...(node as TextState).props, fontWeight: value } } as Partial<TextState>;
      }
      return {};
    },
    400
  );

  const textColor = createBinding<string>(
    (node) => {
      if (node.type === NodeType.TEXT) {
        return (node as TextState).props.color || '#000000';
      }
      return '#000000';
    },
    (node, value) => {
      if (node.type === NodeType.TEXT) {
        return { props: { ...(node as TextState).props, color: value } } as Partial<TextState>;
      }
      return {};
    },
    '#000000'
  );

  const textContent = createBinding<string>(
    (node) => {
      if (node.type === NodeType.TEXT) {
        return (node as TextState).props.content || '';
      }
      return '';
    },
    (node, value) => {
      if (node.type === NodeType.TEXT) {
        return { props: { ...(node as TextState).props, content: value } } as Partial<TextState>;
      }
      return {};
    },
    ''
  );

  // ==================== Shape 属性 ====================

  const cornerRadius = createBinding<number>(
    (node) => {
      if (node.type === NodeType.RECT) {
        return (node as ShapeState).props?.cornerRadius || 0;
      }
      return 0;
    },
    (node, value) => {
      if (node.type === NodeType.RECT) {
        return {
          props: { ...(node as ShapeState).props, cornerRadius: value },
        } as Partial<ShapeState>;
      }
      return {};
    },
    0
  );

  // ==================== 导出 ====================

  return {
    // 核心状态
    activeNode,
    isSingleSelection,

    // 类型判断
    isShape,
    isRect,
    isCircle,
    isText,
    isImage,
    isGroup,

    // Transform 属性
    x,
    y,
    width,
    height,
    rotation,

    // Appearance 属性
    opacity,
    fillColor,
    strokeColor,
    strokeWidth,

    // Text 属性
    fontSize,
    fontFamily,
    fontWeight,
    textColor,
    textContent,

    // Shape 属性
    cornerRadius,
  };
}
