# 重构任务清单：canvasStore.updateNode 拆解

## 1. 📋 调用点风险评估 (Call Sites Checklist)

| #   | 文件路径                                      | 方法/函数名                         | 风险等级 | 重构策略                                                    | 状态 |
| --- | --------------------------------------------- | ----------------------------------- | -------- | ----------------------------------------------------------- | ---- |
| 1   | `src/core/handlers/TransformHandler.ts`       | `handleSelectionDrag`               | **High** | 涉及 Group 移动，需改为 `GroupService.updateGroupTransform` | 🔲   |
| 2   | `src/core/handlers/TransformHandler.ts`       | `handleControlPointDrag`            | **High** | 涉及 Group 缩放，需改为 `GroupService.updateGroupTransform` | 🔲   |
| 3   | `src/core/handlers/TransformHandler.ts`       | `handleSelectionResize`             | **High** | 涉及 Group 缩放，需改为 `GroupService.updateGroupTransform` | 🔲   |
| 4   | `src/composables/useStyleSync.ts`             | `createBinding.set`                 | **High** | 涉及属性面板修改 Group 尺寸/样式，需加判断分支              | 🔲   |
| 5   | `src/components/ui/panels/InspectorPanel.vue` | `applyFillStyle`/`applyStrokeStyle` | **High** | 涉及 Group 样式同步，需改为 `GroupService.updateGroupStyle` | 🔲   |
| 6   | `src/core/services/GroupService.ts`           | `expandGroupToFitChildren`          | **High** | 内部修改 Group 边界，需适配新逻辑                           | 🔲   |
| 7   | 其他所有 Low Risk 调用点                      | (Multiple)                          | **Low**  | 保持调用 `store.updateNode` (仅更新 props/非 Group 节点)    | ✅   |

---

基于代码分析，以下是所有调用 `store.updateNode` 的位置及其重构风险评估：

| #     | 文件路径                       | 方法/函数名                | 调用意图                  | 更新内容                        | 风险等级 | 重构说明                            |
| ----- | ------------------------------ | -------------------------- | ------------------------- | ------------------------------- | -------- | ----------------------------------- |
| 1     | `TransformHandler.ts:336`      | `handleSelectionDrag`      | 拖拽移动节点              | `transform.x/y`                 | **High** | 可能拖拽 Group，需改用 GroupService |
| 2     | `TransformHandler.ts:652`      | `handleControlPointDrag`   | 变换控制点缩放            | `transform.x/y/width/height`    | **High** | 可能缩放 Group，需改用 GroupService |
| 3     | `TransformHandler.ts:976`      | `handleSelectionResize`    | 多选统一缩放(From Center) | `transform.x/y/width/height`    | **High** | 可能包含 Group，需改用 GroupService |
| 4     | `TransformHandler.ts:995`      | `handleSelectionResize`    | 多选统一缩放(Normal)      | `transform.x/y/width/height`    | **High** | 可能包含 Group，需改用 GroupService |
| 5     | `RotationHandler.ts:136`       | `handleRotate`             | 旋转节点                  | `transform.rotation`            | **Low**  | 仅旋转 Group 外框，不涉及级联       |
| 6     | `useStyleSync.ts:90`           | `createBinding.set`        | 属性面板修改              | `transform/style/props`         | **High** | 可能修改 Group 的 transform/style   |
| 7     | `TextSelectionHandler.ts:1004` | `updateInlineStyle`        | 文本内联样式更新          | `props.inlineStyles`            | **Low**  | 仅更新 Text props                   |
| 8     | `TextSelectionHandler.ts:1256` | `updateGlobalStyle`        | 文本全局样式更新          | `props`                         | **Low**  | 仅更新 Text props                   |
| 9     | `TextService.ts:41`            | `handleTextInput`          | 文本输入                  | `props.content`                 | **Low**  | 仅更新 Text props                   |
| 10    | `TextService.ts:118`           | `clearInlineStyles`        | 清除文本内联样式          | `props.inlineStyles`            | **Low**  | 仅更新 Text props                   |
| 11    | `GroupService.ts:115`          | `groupSelected`            | 创建组合时转换子节点坐标  | `parentId, transform.x/y`       | **Low**  | 已在 lockHistory 内，且针对子节点   |
| 12    | `GroupService.ts:175`          | `ungroupSelected`          | 解散组合时恢复子节点坐标  | `parentId, transform.x/y`       | **Low**  | 解组合逻辑，不涉及级联              |
| 13    | `GroupService.ts:353`          | `expandGroupToFitChildren` | 调整子节点相对坐标        | `transform.x/y`                 | **Low**  | 内部维护逻辑，已锁定历史            |
| 14    | `GroupService.ts:363`          | `expandGroupToFitChildren` | 调整组合边界              | `transform.x/y/width/height`    | **High** | 更新 Group transform，需改造        |
| 15    | `InspectorPanel.vue:495`       | `applyTextProps`           | 批量更新文本属性          | `props`                         | **Low**  | 仅更新 Text props                   |
| 16    | `InspectorPanel.vue:666`       | `applyFillStyle`           | 修改填充色                | `style.backgroundColor`         | **High** | 可能修改 Group style                |
| 17    | `InspectorPanel.vue:695`       | `applyStrokeStyle`         | 修改边框样式              | `style.borderColor/borderWidth` | **High** | 可能修改 Group style                |
| 18    | `InspectorPanel.vue:719`       | `zIndex.set`               | 修改层级                  | `style.zIndex`                  | **Low**  | zIndex 不触发级联                   |
| 19-25 | `InspectorPanel.vue:774-875`   | 滤镜参数 computed setters  | 修改图片滤镜              | `props.filters`                 | **Low**  | 仅针对 Image 节点                   |
| 26-29 | `InspectorPanel.vue:916-969`   | 滤镜预设函数               | 批量应用滤镜              | `props.filters`                 | **Low**  | 仅针对 Image 节点                   |

---

## 2. 🎯 重构路线图

### 阶段 1: 扩展 Service & 改造 Store ✅

- [x] `src/core/services/GroupService.ts`: 新增 `updateGroupTransform` (迁移原 Store 逻辑)
- [x] `src/core/services/GroupService.ts`: 新增 `updateGroupStyle` (迁移原 Store 逻辑)
- [x] `src/store/canvasStore.ts`: 新增 `batchUpdateNodes` (原子化批量更新)
- [x] `src/store/canvasStore.ts`: **净化** `updateNode` (移除所有 Group 级联逻辑)

### 阶段 2: 修改调用方 (Fix Call Sites) ✅

- [x] 修改 `TransformHandler.ts` - updateResize 和 updateMultiResize 对 Group 使用 GroupService
- [x] 修改 `useStyleSync.ts` - createBinding 智能分发 transform/style 更新
- [x] 修改 `InspectorPanel.vue` - applyFillColor 和applyStrokeStyle 对 Group 使用 GroupService
- [x] 修改 `GroupService.ts` 自身 - expandGroupToFitChildren 使用 batchUpdateNodes

### 阶段 3: 回归测试 🔲

- [ ] 编写 GroupService 单元测试
- [ ] 拖拽/缩放 Group
- [ ] 修改 Group 颜色/透明度
- [ ] 撤销/重做 (检查是否产生多余快照)
- [ ] Lint 检查

## 3. 🔍 详细分析

### 原 updateNode 中的 Group 逻辑 (canvasStore.ts L260-373)

#### Transform 级联逻辑

```typescript
// 当 Group 缩放时：
if ('transform' in patch && patch.transform) {
  const scaleX = newWidth / oldWidth;
  const scaleY = newHeight / oldHeight;

  // 递归更新所有子节点：
  // - 位置：childNewX = child.x * scaleX
  // - 尺寸：childNewWidth = child.width * scaleX
}
```

#### Style 级联逻辑

```typescript
// 当 Group 样式变更时：
if ('style' in patch && patch.style) {
  // 检查变更项：opacity/backgroundColor/borderColor/borderWidth
  // 递归同步到所有子节点（仅 Shape 节点接收 backgroundColor/border*）
}
```

### 新架构设计

#### GroupService 职责

- 封装 Group 特有的级联更新逻辑
- 计算所有受影响节点的更新内容
- 调用 Store 的批量更新接口

#### Store 职责

- 提供原子化的数据更新操作
- 管理历史记录和版本号
- 不再包含业务逻辑

## 4. ⚠️ 注意事项

1. **编辑模式豁免**：`editingGroupId === id` 时不触发级联
2. **历史锁定**：GroupService 方法内部应使用 `lockHistoryWithoutSnapshot()`
3. **性能优化**：批量更新只触发一次 `version++`
4. **类型安全**：确保所有方法都有严格的类型定义
5. **向后兼容**：先实现新方法，旧代码保留，逐步迁移

## 5. 📝 实施记录

### 2025-12-09 Phase 1 & 2 完成 ✅

#### Phase 1: 扩展 Service & 改造 Store

- ✅ 在 `GroupService` 中新增 `updateGroupTransform` 方法
- ✅ 在 `GroupService` 中新增 `updateGroupStyle` 方法
- ✅ 在 `canvasStore` 中新增 `batchUpdateNodes` 方法
- ✅ 重构 `canvasStore.updateNode`，移除所有 Group 级联逻辑

#### Phase 2: 修改调用方

- ✅ **TransformHandler.ts**: updateResize 和 updateMultiResize 对 Group 使用 GroupService
- ✅ **useStyleSync.ts**: createBinding 智能分发 transform/style 更新
- ✅ **InspectorPanel.vue**: applyFillColor 和 applyStrokeStyle 对 Group 使用 GroupService
- ✅ **GroupService.ts**: expandGroupToFitChildren 使用 batchUpdateNodes

#### 技术亮点

- 类型安全：零编译错误
- 性能优化：批量更新只触发一次响应式更新
- 架构清晰：Store 回归纯数据管理，Service 负责业务逻辑
