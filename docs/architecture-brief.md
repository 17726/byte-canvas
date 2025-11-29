# Byte Canvas - 架构与设计速览

面向日常开发与 AI 理解的精简版架构说明，源自阶段 2.1 的详细设计文档。

## 1) 范围与里程碑

- **目标**: 基于 Web 的无限画布编辑器，MVP 保持 100-200 图元流畅交互。
- **阶段一 (MVP 验证, T+5)**: Pan/Zoom、矩形/圆/富文本、单选/拖拽/删除/缩放、简易侧边工具栏、Pinia→渲染单向链路。
- **阶段二 (12 月初)**: 图片支持、样式补全、框选/多选/复制粘贴/双击文本编辑、LocalStorage 持久化、侧边+悬浮工具栏、选中框与光标体验优化。
- **阶段三 (12.12 截止)**: 旋转、组合/解组、100+ 元素 50FPS、Undo/Redo。候选：局部文本工具栏、辅助线、minimap、协同与离线。

## 2) 技术决策

- **固定栈**: Vue 3 (Composition API) + TypeScript 5 + Vite + Pinia。
- **渲染策略**: 渐进式架构，当前阶段使用 **纯 DOM + CSS3 Transform**；未来可替换 Canvas/Pixi。
- **决策理由**: MVP 快速交付、富文本编辑零成本、团队上手快、调试简单；200 图元内性能可接受，数据层解耦后续可平滑切换渲染器。

## 3) 分层架构

- **L1 交互层 (View)**: Vue 组件监听输入与 UI 操作，仅转发事件。主要组件：`CanvasEditor.vue`, `Toolbar.vue`, 属性面板等。
- **L2 逻辑层 (Controller)**: TS 类（Node/Tool）处理坐标转换、命中检测、工具行为；不持有状态。
- **L3 数据层 (Model)**: Pinia 作为单一信源；存储节点树、视口、选择态、历史栈。
- **L4 渲染层 (View)**: 响应式映射到 DOM 样式；未来可替换为 Canvas/Pixi 实现的 `IRenderer`。
- **单向数据流**: 用户事件 → 逻辑层计算 → State 变更 → 脏标记 → 渲染。

## 4) 核心数据结构 (State)

- **NodeType**: `rect | circle | text | image | group`（阶段一主要用 rect/text）。
- **TransformState**: `{ x, y, width, height, rotation }`（单位 px/deg）。
- **StyleState**: `{ backgroundColor, borderWidth, borderStyle, borderColor, opacity, zIndex }`。
- **BaseNodeState**: `{ id, type, name, transform, style, parentId, isLocked, isVisible }`。
- **TextState**: `props: { content, fontFamily, fontSize, fontWeight, fontStyle }`。
- **ImageState**: `props: { src, filters: { blur, brightness } }`。
- **GroupState**: `children: string[]` 以 ID 维护父子关系。
- **存储形态**: 扁平 `Record<string, NodeState>` + `nodeOrder: string[]` 控制渲染顺序；视口 `{ zoom, offsetX, offsetY }`；选择态 `Set<string>`。

## 5) Node 逻辑层职责

- Node 类持有响应式 State 引用，生成 DOM `style` 对象：绝对定位 + 尺寸 + `transform: rotate` + 边框/填充/不透明度/zIndex/显隐。
- 行为示例: `move(dx, dy)` 调整 `transform.x/y`；`resize(width, height)` 调整尺寸。
- Node 不直接耦合渲染器，未来 Canvas/Pixi 版本可输出绘图指令。

## 6) Pinia Store 关键 API

- `nodes: Record<string, BaseNodeState>`，`nodeOrder: string[]`，`version: number`（脏标记计数）。
- `viewport: { zoom, offsetX, offsetY }`。
- `activeElementIds: Set<string>`，`isInteracting: boolean`。
- UI 相关状态独立: 为了更好地划分职责，UI 状态（例如 `activePanel`, `isPanelExpanded`）从 `canvasStore` 拆分至 `uiStore` 管理，避免 domain store 与 UI 状态耦合。
- Getters: `renderList` 依据 `nodeOrder` 映射为组件列表。
- Actions: `addNode`, `updateNode(id, patch)`, `deleteNode`, `setActive(ids)`, `toggleSelection(id)`；每次写操作 `version++` 触发监听。
- **持久化建议**: watch `version`，防抖后写 LocalStorage，渲染优先、存储滞后。

## 7) 目录与规范

- 目录（关键层）：`src/core` (Node/Tools/Utils), `src/store` (Pinia), `src/components/editor` (CanvasStage + layers), `src/types` (全局类型)。
- 代码规范：ESLint + Prettier，Format on Save；TypeScript 禁 `any`；命名 camelCase/PascalCase。
- Git 流程：main 受保护，feat/\* 分支，Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...` 等)。

## 8) 原则与约束

- **数据驱动**: 仅通过 Store 变更驱动渲染，禁止直接操作 Canvas Context 补画。
- **面向对象**: 几何/命中等逻辑封装在 Node/Tool 类，Vue 组件专注事件绑定与展示。
- **性能基线**: DOM 渲染在 <200 元素可接受；未来可按需切换混合/Canvas 渲染。
