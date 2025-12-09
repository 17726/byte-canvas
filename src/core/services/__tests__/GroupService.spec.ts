/**
 * @file GroupService.spec.ts
 * @description GroupService 单元测试
 *
 * 测试重构后的核心方法：
 * 1. updateGroupTransform - Group 变换级联更新
 * 2. updateGroupStyle - Group 样式级联更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupService } from '../GroupService';
import { NodeType } from '@/types/state';
import type { GroupState, NodeState, ShapeState, TextState } from '@/types/state';

describe('GroupService', () => {
  // 模拟 Store
  let mockStore: {
    nodes: Record<string, NodeState>;
    editingGroupId: string | null;
    batchUpdateNodes: ReturnType<typeof vi.fn>;
    updateNode: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // 重置模拟 Store
    mockStore = {
      nodes: {},
      editingGroupId: null,
      batchUpdateNodes: vi.fn(),
      updateNode: vi.fn(),
    };
  });

  describe('updateGroupTransform', () => {
    it('应该正确缩放 Group 及其所有子节点', () => {
      // 准备测试数据：1 个 Group + 2 个子节点
      const groupId = 'group-1';
      const childId1 = 'rect-1';
      const childId2 = 'circle-1';

      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: {
          x: 100,
          y: 100,
          width: 200,
          height: 200,
          rotation: 0,
        },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [childId1, childId2],
      };

      const child1: ShapeState = {
        id: childId1,
        type: NodeType.RECT,
        name: 'Child Rect',
        transform: {
          x: 50, // 相对坐标
          y: 50,
          width: 100,
          height: 80,
          rotation: 0,
        },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: '#000000',
          opacity: 1,
          zIndex: 0,
        },
        props: {
          cornerRadius: 0,
        },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      const child2: ShapeState = {
        id: childId2,
        type: NodeType.CIRCLE,
        name: 'Child Circle',
        transform: {
          x: 25,
          y: 120,
          width: 60,
          height: 60,
          rotation: 0,
        },
        style: {
          backgroundColor: '#00ff00',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#333333',
          opacity: 1,
          zIndex: 0,
        },
        props: {},
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = {
        [groupId]: groupNode,
        [childId1]: child1,
        [childId2]: child2,
      };

      // 执行：将 Group 缩放为原来的 2 倍
      GroupService.updateGroupTransform(mockStore as any, groupId, {
        width: 400, // 原 200 -> 400 (scaleX = 2)
        height: 400, // 原 200 -> 400 (scaleY = 2)
      });

      // 断言 1：batchUpdateNodes 应该被调用
      expect(mockStore.batchUpdateNodes).toHaveBeenCalledTimes(1);

      // 断言 2：验证传递给 batchUpdateNodes 的更新对象
      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 验证 Group 自身更新
      expect(updates[groupId]).toMatchObject({
        transform: {
          x: 100,
          y: 100,
          width: 400,
          height: 400,
          rotation: 0,
        },
      });

      // 验证子节点 1 的缩放（位置和尺寸都应该翻倍）
      expect(updates[childId1]).toMatchObject({
        transform: {
          x: 100, // 50 * 2
          y: 100, // 50 * 2
          width: 200, // 100 * 2
          height: 160, // 80 * 2
        },
      });

      // 验证子节点 2 的缩放
      expect(updates[childId2]).toMatchObject({
        transform: {
          x: 50, // 25 * 2
          y: 240, // 120 * 2
          width: 120, // 60 * 2
          height: 120, // 60 * 2
        },
      });
    });

    it('应该在编辑模式下不触发级联更新', () => {
      const groupId = 'group-1';
      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [],
      };

      mockStore.nodes = { [groupId]: groupNode };
      mockStore.editingGroupId = groupId; // 设置为编辑模式

      GroupService.updateGroupTransform(mockStore as any, groupId, { width: 400 });

      // 断言：应该调用 updateNode 而不是 batchUpdateNodes
      expect(mockStore.updateNode).toHaveBeenCalledTimes(1);
      expect(mockStore.batchUpdateNodes).not.toHaveBeenCalled();
    });

    it('应该只在尺寸改变时更新子节点', () => {
      const groupId = 'group-1';
      const childId = 'rect-1';

      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 100, y: 100, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [childId],
      };

      const child: ShapeState = {
        id: childId,
        type: NodeType.RECT,
        name: 'Child',
        transform: { x: 50, y: 50, width: 100, height: 100, rotation: 0 },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        props: { cornerRadius: 0 },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = { [groupId]: groupNode, [childId]: child };

      // 执行：仅改变位置，不改变尺寸
      GroupService.updateGroupTransform(mockStore as any, groupId, {
        x: 150,
        y: 150,
      });

      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 断言：Group 位置更新，但子节点不应该被包含在更新中（因为相对位置不变）
      expect(updates[groupId]).toBeDefined();
      expect(updates[childId]).toBeUndefined();
    });
  });

  describe('updateGroupStyle', () => {
    it('应该同步更新 opacity 到所有子节点', () => {
      const groupId = 'group-1';
      const childId1 = 'rect-1';
      const childId2 = 'text-1';

      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [childId1, childId2],
      };

      const child1: ShapeState = {
        id: childId1,
        type: NodeType.RECT,
        name: 'Child Rect',
        transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        props: { cornerRadius: 0 },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      const child2: TextState = {
        id: childId2,
        type: NodeType.TEXT,
        name: 'Child Text',
        transform: { x: 0, y: 100, width: 100, height: 50, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        props: {
          content: 'Test',
          fontSize: 16,
          fontFamily: 'Arial',
          fontWeight: 400,
          color: '#000000',
          textAlign: 'left',
          inlineStyles: [],
        },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = {
        [groupId]: groupNode,
        [childId1]: child1,
        [childId2]: child2,
      };

      // 执行：修改 Group 透明度为 0.5
      GroupService.updateGroupStyle(mockStore as any, groupId, { opacity: 0.5 });

      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 断言：Group 和所有子节点的 opacity 都应该更新为 0.5
      expect(updates[groupId].style.opacity).toBe(0.5);
      expect(updates[childId1].style.opacity).toBe(0.5);
      expect(updates[childId2].style.opacity).toBe(0.5);
    });

    it('应该只对 Shape 子节点同步 backgroundColor', () => {
      const groupId = 'group-1';
      const rectId = 'rect-1';
      const textId = 'text-1';

      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: '#ffffff',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [rectId, textId],
      };

      const rect: ShapeState = {
        id: rectId,
        type: NodeType.RECT,
        name: 'Rect',
        transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        props: { cornerRadius: 0 },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      const text: TextState = {
        id: textId,
        type: NodeType.TEXT,
        name: 'Text',
        transform: { x: 0, y: 100, width: 100, height: 50, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        props: {
          content: 'Test',
          fontSize: 16,
          fontFamily: 'Arial',
          fontWeight: 400,
          color: '#000000',
          textAlign: 'left',
          inlineStyles: [],
        },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = { [groupId]: groupNode, [rectId]: rect, [textId]: text };

      // 执行：修改 Group 背景色
      GroupService.updateGroupStyle(mockStore as any, groupId, { backgroundColor: '#00ff00' });

      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 断言：Group 自身应该更新
      expect(updates[groupId].style.backgroundColor).toBe('#00ff00');

      // 断言：Shape 子节点（rect）应该同步更新背景色
      expect(updates[rectId].style.backgroundColor).toBe('#00ff00');

      // 断言：Text 子节点不应该更新背景色（Text 不是 Shape）
      expect(updates[textId]).toBeUndefined();
    });

    it('应该同步 borderColor 和 borderWidth 到 Shape 子节点', () => {
      const groupId = 'group-1';
      const circleId = 'circle-1';

      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'solid',
          borderColor: '#000000',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [circleId],
      };

      const circle: ShapeState = {
        id: circleId,
        type: NodeType.CIRCLE,
        name: 'Circle',
        transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#333333',
          opacity: 1,
          zIndex: 0,
        },
        props: {},
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = { [groupId]: groupNode, [circleId]: circle };

      // 执行：修改 Group 边框
      GroupService.updateGroupStyle(mockStore as any, groupId, {
        borderColor: '#ff00ff',
        borderWidth: 3,
      });

      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 断言：子节点边框应该同步
      expect(updates[circleId].style.borderColor).toBe('#ff00ff');
      expect(updates[circleId].style.borderWidth).toBe(3);
    });

    it('应该在编辑模式下不触发级联更新', () => {
      const groupId = 'group-1';
      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [],
      };

      mockStore.nodes = { [groupId]: groupNode };
      mockStore.editingGroupId = groupId; // 编辑模式

      GroupService.updateGroupStyle(mockStore as any, groupId, { opacity: 0.5 });

      // 断言：应该调用 updateNode 而不是 batchUpdateNodes
      expect(mockStore.updateNode).toHaveBeenCalledTimes(1);
      expect(mockStore.batchUpdateNodes).not.toHaveBeenCalled();
    });

    it('应该只在样式值真正改变时才同步', () => {
      const groupId = 'group-1';
      const childId = 'rect-1';

      const groupNode: GroupState = {
        id: groupId,
        type: NodeType.GROUP,
        name: 'Test Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 0.8,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [childId],
      };

      const child: ShapeState = {
        id: childId,
        type: NodeType.RECT,
        name: 'Child',
        transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 0.8,
          zIndex: 0,
        },
        props: { cornerRadius: 0 },
        parentId: groupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = { [groupId]: groupNode, [childId]: child };

      // 执行：设置相同的 opacity 值（没有变化）
      GroupService.updateGroupStyle(mockStore as any, groupId, { opacity: 0.8 });

      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 断言：Group 应该更新，但子节点不应该被包含（因为值没变）
      expect(updates[groupId]).toBeDefined();
      expect(updates[childId]).toBeUndefined();
    });
  });

  describe('嵌套 Group 级联更新', () => {
    it('应该递归更新嵌套 Group 的所有后代节点', () => {
      const parentGroupId = 'group-parent';
      const childGroupId = 'group-child';
      const grandchildId = 'rect-grandchild';

      const parentGroup: GroupState = {
        id: parentGroupId,
        type: NodeType.GROUP,
        name: 'Parent Group',
        transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
        children: [childGroupId],
      };

      const childGroup: GroupState = {
        id: childGroupId,
        type: NodeType.GROUP,
        name: 'Child Group',
        transform: { x: 50, y: 50, width: 100, height: 100, rotation: 0 },
        style: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        parentId: parentGroupId,
        isLocked: false,
        isVisible: true,
        children: [grandchildId],
      };

      const grandchild: ShapeState = {
        id: grandchildId,
        type: NodeType.RECT,
        name: 'Grandchild',
        transform: { x: 25, y: 25, width: 50, height: 50, rotation: 0 },
        style: {
          backgroundColor: '#ff0000',
          borderWidth: 0,
          borderStyle: 'none',
          borderColor: 'transparent',
          opacity: 1,
          zIndex: 0,
        },
        props: { cornerRadius: 0 },
        parentId: childGroupId,
        isLocked: false,
        isVisible: true,
      };

      mockStore.nodes = {
        [parentGroupId]: parentGroup,
        [childGroupId]: childGroup,
        [grandchildId]: grandchild,
      };

      // 执行：缩放父 Group 为 2 倍
      GroupService.updateGroupTransform(mockStore as any, parentGroupId, {
        width: 400,
        height: 400,
      });

      const updates = mockStore.batchUpdateNodes.mock.calls[0][0];

      // 断言：嵌套的子 Group 应该缩放
      expect(updates[childGroupId].transform.width).toBe(200); // 100 * 2
      expect(updates[childGroupId].transform.height).toBe(200);

      // 断言：孙子节点也应该缩放
      expect(updates[grandchildId].transform.width).toBe(100); // 50 * 2
      expect(updates[grandchildId].transform.height).toBe(100);
    });
  });
});
