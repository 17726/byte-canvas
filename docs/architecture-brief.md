# Byte Canvas - 架构设计白皮书 (v2.3)

> **版本**: v2.3 (Store Purification & Atomic Updates)
> **最后更新**: 2025.12

本文档描述了 Byte Canvas 的核心架构设计，旨在指导开发并作为 AI 辅助编程的上下文准则。

## 1\. 设计哲学

1.  **渐进式渲染 (Progressive Rendering)**:
    - **现状**: MVP 阶段利用 DOM + CSS3 Transform 实现快速开发，利用浏览器原生的事件冒泡和文本编辑能力。
    - **未来**: 通过 `INodeRenderer` 接口隔离渲染逻辑。当图元数量 \> 500 时，可无缝替换为 Canvas/WebGL 渲染器，而无需修改上层业务逻辑。

2.  **关注点分离 (Separation of Concerns)**:
    - **UI (Interface)** 与 **Canvas (World)** 在物理目录和逻辑上分离。
    - **交互 (Interaction)** 与 **业务 (Domain)** 分离。
    - **状态 (State)** 由 Store 统一管理，但 Store 仅负责存取，不负责业务计算。

## 2\. 六层架构模型 (Six-Layer Architecture)

系统采用严格的分层架构，数据流向总体呈单向闭环。**v2.3 重点强化了 Service 层与 Store 层的职责边界。**

### 层级职责详解

| 层级              | 载体 (Path)      | 职责描述                                                                                           | 依赖原则    |
| :---------------- | :--------------- | :------------------------------------------------------------------------------------------------- | :---------- |
| **L1 视图层**     | `components/`    | **只负责展示**。Vue 组件，极薄。负责布局、样式渲染和原生事件转发。                                 | 依赖 L2, L6 |
| **L2 逻辑胶水层** | `composables/`   | **负责连接与反馈**。连接 UI 与内核，智能分发操作（判断调用 Service 还是 Store），管理副作用。      | 依赖 L4, L5 |
| **L3 交互控制层** | `core/handlers`  | **负责路由与状态**。处理连续事件流（Drag/Resize），将交互意图转换为具体的 Service 调用。           | 依赖 L4, L5 |
| **L4 业务领域层** | `core/services`  | **负责业务逻辑**。处理级联更新（如 Group）、复杂计算、批量操作准备。**纯逻辑，无状态**。           | 依赖 L5     |
| **L5 数据层**     | `store/`         | **数据仓库**。Pinia Store，负责原子化的数据读写、历史记录（Undo/Redo）和持久化。**不含业务逻辑**。 | 无依赖      |
| **L6 渲染层**     | `core/renderers` | **负责绘制**。策略模式，将 Node 数据翻译为视觉属性（CSS 或 Canvas 指令）。                         | 依赖 L5     |

## 3\. 双通道数据流 (Dual Channel Data Flow)

为了平衡“高频操作的性能”与“复杂业务的可维护性”，系统设计了两条独立的数据流通道。

### 通道 A：交互流 (Interaction Pipeline)

> **场景**: 鼠标拖拽节点、缩放画布、框选区域。
> **特征**: 高频触发 (60fps)，依赖临时状态（startX, isDragging），需极致性能。

1.  **View**: 监听原生 DOM 事件 (`mousedown`, `mousemove`)。
2.  **ToolManager**: 作为“交通警察”，将事件路由给正确的 Handler (TransformHandler)。
3.  **Handler**:
    - 计算位移差 (`dx`, `dy`)。
    - **决策**：如果是普通节点，直接调用 Store；如果是复杂节点（Group），调用 `GroupService`。
4.  **Service/Store**:
    - `GroupService`: 计算级联更新，调用 `store.batchUpdateNodes`。
    - `Store`: 执行 `updateNode` 或 `batchUpdateNodes`。
5.  **Render**: 画布响应式更新。

### 通道 B：命令流 (Command Pipeline)

> **场景**: 点击属性面板、工具栏按钮、快捷键 (Ctrl+G)。
> **特征**: 单次触发，明确的原子业务指令。

1.  **View**: 捕捉点击或键盘事件。
2.  **Composable**: 调用 `useStyleSync` 或 `useNodeActions`。
    - **智能分发**：检查当前选中节点类型。
    - 若为 Group 且修改几何属性 -> 调用 `GroupService`。
    - 否则 -> 调用 `Store`。
3.  **Service**: 执行业务逻辑（如计算组合包围盒、递归样式同步）。
4.  **Store**: 写入数据变更（原子化提交）。

## 4\. 目录结构规范

```text
src/
├── components/                 # [L1] 纯展示组件
├── composables/                # [L2] 逻辑胶水层
│   ├── useNodeActions.ts       # 节点操作
│   └── useStyleSync.ts         # 属性绑定 (含智能分发逻辑)
├── core/                       # [L3/L4/L6] 核心内核层 (Pure TS)
│   ├── ToolManager.ts          # [L3] 交互事件总线
│   ├── handlers/               # [L3] 有状态交互 (TransformHandler 等)
│   ├── services/               # [L4] 无状态业务 (核心重构区)
│   │   ├── GroupService.ts     # 组合逻辑 (Transform/Style 级联)
│   │   └── TextService.ts      # 文本逻辑
│   ├── renderers/              # [L6] 渲染适配器
│   └── utils/                  # [基建] 纯算法 (Geometry)
└── store/                      # [L5] 数据层 (CanvasStore, UIStore)
    ├── canvasStore.ts          # 画布数据 (节点列表、历史记录)
    └── uiStore.ts              # UI 状态 (选中节点、当前工具)
```

## 5\. 🤖 AI 辅助开发指南 (AI Context Rules)

为了防止代码劣化，AI (Copilot/Cursor) 生成代码时必须遵守以下规则：

1.  **Store 纯粹性原则 (Store Purity)**:
    - `canvasStore` 禁止包含复杂的业务逻辑（如“如果是 Group 则递归更新子节点”）。
    - Store 只负责 CRUD 和 `batchUpdateNodes`（原子更新）。
    - 任何涉及多节点联动、级联更新的逻辑，**必须** 放入 `core/services/`。

2.  **原子化更新原则 (Atomic Updates)**:
    - 涉及多个节点的修改（如解组、多选移动），**必须** 使用 `store.batchUpdateNodes`。
    - 禁止在一个操作循环中多次调用 `store.updateNode`，这会破坏撤销/重做栈。

3.  **显式引用 Context**:
    - 修改几何逻辑时，优先使用 `src/core/utils/geometry.ts`。
    - 涉及 Group 操作时，必须检查 `src/core/services/GroupService.ts` 是否已有现成方法。

4.  **架构对齐检查**:
    - **UI 组件**禁止包含业务逻辑，只能调用 `Composables`。
    - **Handler** 负责交互状态管理，不负责业务计算，复杂计算委托给 **Service**。
