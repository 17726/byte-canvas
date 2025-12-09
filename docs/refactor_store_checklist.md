# 🏗️ 目标架构设计 (Target Architecture)

- `useCanvasStore`：负责画布数据层，管理节点/边/分组等业务实体；状态字段示例：`nodes`（字典或列表）、`nodeIndex`（加速查找）、`nodeMeta`（尺寸/锚点/锁定等）、与节点写相关的基础 Action（增删改、批量更新）。
- `useViewportStore`：负责视口与坐标系；状态字段示例：`viewport`（位置/尺寸）、`zoom`（缩放因子）、`panOffset`/`scrollOffset`、`snapConfig`（对齐与吸附配置）、与视口写相关的 Action（`setZoom`、`panTo`、`fitView`）。
- `useSelectionStore`：负责用户选中/编辑上下文；状态字段示例：`activeElementIds`、`editingGroupId`、`hoveredId`/`focusId`、`selectionMode`；Action（`setActive`、`selectAll`、`clearSelection`、`startEditingGroup` 等）。
- `useHistoryStore`：负责时光机（Undo/Redo）；状态字段示例：`past`、`future`、`currentPointer`/`isRecording`、`lastSnapshotMeta`；核心职责是聚合/还原其他 Store 的状态。

# 🚦 依赖关系分析 (Dependency Analysis)

- 依赖流向：`Canvas` ← `Selection` 读取 `nodes` 进行过滤校验；`Viewport` 独立但会被 Selection/History 读取；`History` 依赖其他三个 Store 创建快照，不反向依赖业务逻辑。
- `useHistoryStore` 聚合：`createSnapshot` 从 `useCanvasStore`（节点数据）、`useViewportStore`（视口/缩放）、`useSelectionStore`（选中/编辑上下文）读取，形成统一 `Snapshot`。
- `useHistoryStore` 分发：`restoreSnapshot` 将快照分发到三个 Store 的 setter/action（避免直接写内部 state），保证解耦。
- 订阅模式：避免 `canvasStore` 主动调用 History，改用 `HistoryStore` `$subscribe` 或在关键 Action 中注入 hook（如 `afterNodeMutate`、`afterSelectionChange`）触发记录。

# 📝 阶段性任务清单 (Phased Checklist)

## Phase 1: Viewport Store 独立 (Low Risk)

- [ ] 创建 `src/store/viewportStore.ts`。
- [ ] 迁移 `viewport`, `setZoom` 等状态和方法。
- [ ] 修改 `ViewportHandler.ts` 和 `ToolManager.ts` 中的引用。
- [ ] 清理 `canvasStore.ts` 中的冗余代码。

## Phase 2: Selection Store 独立 (Medium Risk)

- [ ] 创建 `src/store/selectionStore.ts`。
- [ ] 迁移 `activeElementIds`, `editingGroupId`。
- [ ] 迁移 `setActive`, `selectAll` 等 Action。
- [ ] **注意**: 这里的 `setActive` 需要访问 `canvasStore.nodes` 进行过滤校验。
- [ ] 修改 `SelectionHandler`, `TransformHandler`, `GroupService` 中的引用。

## Phase 3: History Store 独立 (High Risk)

- [ ] 创建 `src/store/historyStore.ts`。
- [ ] 重构 `Snapshot` 类型定义（需要包含 Nodes + Viewport + Selection）。
- [ ] 实现 `createSnapshot` (从三个 Store 聚合数据)。
- [ ] 实现 `restoreSnapshot` (分发数据到三个 Store)。
- [ ] **关键**: 解耦 `canvasStore` 对 History 的直接调用（考虑使用 `$subscribe` 或 Action 钩子）。
