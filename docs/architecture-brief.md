# Byte Canvas - 架构设计白皮书 (v2.2)

> **版本**: v2.2 (Logic Extraction & UI/Canvas Separation)
> **最后更新**: 2025.12

本文档描述了 Byte Canvas 的核心架构设计，旨在指导开发并作为 AI 辅助编程的上下文准则。

## 1\. 设计哲学

1.  **渐进式渲染 (Progressive Rendering)**:
    - **现状**: MVP 阶段利用 DOM + CSS3 Transform 实现快速开发，利用浏览器原生的事件冒泡和文本编辑能力。
    - **未来**: 通过 `INodeRenderer` 接口隔离渲染逻辑。当图元数量 \> 500 时，可无缝替换为 Canvas/WebGL 渲染器，而无需修改上层业务逻辑。

2.  **关注点分离 (Separation of Concerns)**:
    - **UI (Interface)** 与 **Canvas (World)** 在物理目录和逻辑上分离。
    - **交互 (Interaction)** 与 **业务 (Domain)** 分离。
    - **状态 (State)** 由 Store 统一管理，拒绝组件内隐式状态。

## 2\. 六层架构模型 (Six-Layer Architecture)

系统采用严格的分层架构，数据流向总体呈单向闭环，但在交互层存在特定的性能优化通道。

### 层级职责详解

| 层级              | 载体 (Path)      | 职责描述                                                                                     | 依赖原则    |
| :---------------- | :--------------- | :------------------------------------------------------------------------------------------- | :---------- |
| **L1 视图层**     | `components/`    | **只负责展示**。Vue 组件，极薄。负责布局、样式渲染和原生事件转发。                           | 依赖 L2, L6 |
| **L2 逻辑胶水层** | `composables/`   | **负责连接与反馈**。连接 UI 与内核，管理副作用（Notification, Dialog）和响应式状态映射。     | 依赖 L4, L5 |
| **L3 交互控制层** | `core/handlers`  | **负责路由与状态**。处理鼠标/键盘的连续事件流，维护交互过程中的临时状态（如 `isDragging`）。 | 依赖 L4, L5 |
| **L4 业务领域层** | `core/services`  | **负责计算**。纯数学计算、节点工厂、组合逻辑。无状态，纯 TypeScript，易于测试。              | 依赖 L5     |
| **L5 数据层**     | `store/`         | **单一信源**。Pinia Store，负责数据存储、持久化和变更通知。                                  | 无依赖      |
| **L6 渲染层**     | `core/renderers` | **负责绘制**。策略模式，将 Node 数据翻译为视觉属性（CSS 或 Canvas 指令）。                   | 依赖 L5     |

## 3\. 双通道数据流 (Dual Channel Data Flow)

为了平衡“高频操作的性能”与“复杂业务的可维护性”，系统设计了两条独立的数据流通道。

### 通道 A：交互流 (Interaction Pipeline)

> **场景**: 鼠标拖拽节点、缩放画布、框选区域。
> **特征**: 高频触发 (60fps)，依赖临时状态（startX, isDragging），需极致性能。

1.  **View**: 监听原生 DOM 事件 (`mousedown`, `mousemove`)。
2.  **ToolManager**: 作为“交通警察”，根据按键状态（Space/Ctrl）和位置，将事件路由给正确的 Handler。
3.  **Handler**: 计算位移差 (`dx`, `dy`)，执行具体的位移/缩放逻辑。
4.  **Store**: 更新节点坐标或视口状态 (Batch Update)。
5.  **Render**: 画布响应式更新。

### 通道 B：命令流 (Command Pipeline)

> **场景**: 点击工具栏按钮、右键菜单、键盘快捷键 (Ctrl+C)。
> **特征**: 单次触发，明确的原子业务指令，伴随 UI 反馈。

1.  **View**: 捕捉点击或键盘事件。
2.  **Composable**: 调用 `useNodeActions` 或 `useStyleSync`。
    - 执行前置检查（如 `canGroup`）。
    - 调用底层 Service 执行逻辑。
    - 处理执行后的反馈（如 `Notification.success`）。
3.  **Service**: 执行纯业务逻辑（如生成新节点数据、计算组合包围盒）。
4.  **Store**: 写入数据变更。

## 4\. 目录结构规范

```text
src/
├── components/                 # [L1] 纯展示组件
│   ├── canvas/                 # >> 画布视口相关 (World)
│   │   ├── layers/             # 图元组件 (RectLayer, GroupLayer...)
│   │   ├── CanvasStage.vue     # 画布容器
│   │   └── SelectionOverlay.vue# 交互反馈层
│   └── ui/                     # >> 用户界面相关 (Interface)
│       ├── panels/             # 固定面板 (ToolPanel, InspectorPanel...)
│       ├── floating/           # 浮动控件 (ContextMenu, HoverToolbar...)
│       └── common/             # 通用组件
├── composables/                # [L2] 逻辑胶水层
│   ├── useNodeActions.ts       # 节点操作 (删除、组合、层级)
│   └── useStyleSync.ts         # 属性双向绑定
├── core/                       # [L3/L4/L6] 核心内核层 (Pure TS)
│   ├── ToolManager.ts          # [L3] 交互事件总线
│   ├── handlers/               # [L3] 有状态交互
│   ├── services/               # [L4] 无状态业务
│   ├── renderers/              # [L6] 渲染适配器
│   └── utils/                  # [基建] 纯算法
└── store/                      # [L5] 数据层
```

## 5\. 🤖 AI 辅助开发指南 (AI Context Rules)

为了防止代码劣化，AI (Copilot/Cursor) 生成代码时必须遵守以下规则：

1.  **显式引用 Context**:
    - 修改几何逻辑时，必须读取 `src/core/utils/geometry.ts`。
    - 修改数据结构时，必须读取 `src/store/canvasStore.ts`。

2.  **拒绝重复造轮子**:
    - 严禁在组件中手写坐标计算，必须调用 `clientToWorld` 或 `geometry` 工具函数。
    - 严禁手动拼凑节点对象，必须调用 `NodeFactory`。

3.  **架构对齐检查**:
    - **UI 组件**禁止包含业务逻辑，只能调用 `Composables` 或 `ToolManager`。
    - **ToolManager** 禁止包含业务逻辑（如创建节点），只负责分发事件。
    - **Services** 必须是纯函数或静态类，禁止包含 UI 逻辑（如 Notification）。UI 反馈必须在 **Composables** 层处理。
