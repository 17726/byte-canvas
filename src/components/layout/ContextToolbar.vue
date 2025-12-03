  <template>
    <div v-if="isVisible" class="context-toolbar" :style="positionStyle" @mousedown.stop>
      <!-- Common Properties (Opacity & Layer) -->
      <div class="tool-section">
          <div class="tool-item">
            <a-tooltip placement="top" title="不透明度" :mouseEnterDelay="0.3">
              <span class="label" style="pointer-events: none;width: 38px;">透明度</span>
              <a-slider
                v-model="opacity"
                :min="0"
                :max="1"
                :step="0.01"
                style="width: 60px; margin-left: 8px"
                size="mini"
                :tooltip-visible="false"
              />
            </a-tooltip>
          </div>
        <div class="divider"></div>
        <div class="tool-item">
    <a-popover trigger="click" position="bottom" content-class="layer-popover">
      <a-tooltip placement="top" content="图层顺序">
            <a-button size="mini" type="text">
              <icon-layers />
            </a-button>
          </a-tooltip>
    <!-- 展开的内容（添加提示文字） -->
    <template #content>
      <div class="popover-row">
        <a-button size="mini" type="text" @click="bringToFront" long>
          <template #icon><icon-bring-to-front /></template>
          置于顶层
        </a-button>
        <a-button size="mini" type="text" @click="sendToBack" long>
          <template #icon><icon-send-to-back /></template>
          置于底层
        </a-button>
      </div>
    </template>
  </a-popover>
  </div>
      </div>

      <div class="divider" v-if="isShape || isText"></div>

      <!-- Shape Controls -->
      <template v-if="isShape">
        <div class="tool-item">
          <a-tooltip placement="top" content="填充色">
            <a-color-picker size="mini" v-model="fillColor" trigger="hover" disabled-alpha />
          </a-tooltip>
        </div>
        <div class="divider"></div>
        <div class="tool-item">
          <a-tooltip placement="top" content="边框色">
            <a-color-picker size="mini" v-model="strokeColor" trigger="hover" />
          </a-tooltip>
        </div>
        <div class="tool-item">
          <span style="width: 50px;">边框：</span>
          <!-- <a-input-number
            size="mini"
            v-model="strokeWidth"
            :min="0"
            :max="20"
            style="width: 50px"
            hide-button
            class="input-demo"
          /> -->
          <a-input-number 
          size="mini"
          v-model="strokeWidth" 
          style="width: 50px" 
          class="input-demo"
          :min="0" 
          :max="100"/>
        </div>
      </template>

      <!-- Text Controls -->
      <template v-if="isText">
        <div class="tool-item" style="width: 85px">
          字号:
          <!-- <a-input-number
            size="mini"
            v-model="fontSize"
            :min="12"
            :max="100"
            style="width: 50px;margin-left: 2px;"
            hide-button
            mode="button" 
          /> -->
          <a-input-number 
          size="mini"
          v-model="fontSize" 
          style="width: 50px;margin-left: 2px;" 
          class="input-demo"
          :min="12" 
          :max="100"/>
        </div>
        <div class="tool-item">
        <a-popover trigger="click" position="bottom" content-class="toolbar-popover-content">
            <a-tooltip placement="top" content="文本样式">
            <a-button size="mini" type="text">
              <icon-text />
            </a-button>
          </a-tooltip>
          <template #content>
            <div class="popover-grid">
               <a-tooltip content="加粗" :mouse-enter-delay="0.5">
                <a-button size="mini" :type="isBold ? 'primary' : 'text'" @click="toggleBold">
                  <icon-text-bold />
                </a-button>
              </a-tooltip>
              <a-tooltip content="倾斜" :mouse-enter-delay="0.5">
                <a-button size="mini" :type="isItalic ? 'primary' : 'text'" @click="toggleItalic">
                  <icon-text-italic />
                </a-button>
              </a-tooltip>
              <a-tooltip content="下划线" :mouse-enter-delay="0.5">
                <a-button size="mini" :type="isUnderline ? 'primary' : 'text'" @click="toggleUnderline">
                  <icon-text-underline />
                </a-button>
              </a-tooltip>
              <a-tooltip content="删除线" :mouse-enter-delay="0.5">
                <a-button size="mini" :type="isStrikethrough ? 'primary' : 'text'" @click="toggleStrikethrough">
                  <icon-strikethrough />
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </a-popover>
      </div>
        <div class="tool-item">
          <a-color-picker size="mini" v-model="textColor" trigger="hover" />
        </div>
      </template>

      <template v-if="isImage">
        <!-- <div class="tool-item">
          <div class="prop-item">
                <div class="filter-options">
                  <a-tooltip placement="top" content="黑白">
                    <div class="filter-item" @click="selectFilter('grayscale')">
                      <div
                        class="filter-preview"
                        :class="{ active: selectedFilter === 'grayscale' }"
                        :style="{
                          backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                          filter: 'grayscale(100%) contrast(110%) brightness(95%)',
                        }"
                      ></div>
                    </div>
                  </a-tooltip>
                  <a-tooltip placement="top" content="模糊">
                    <div class="filter-item" @click="selectFilter('blur')">
                      <div
                        class="filter-preview"
                        :class="{ active: selectedFilter === 'blur' }"
                        :style="{
                          backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                          filter: 'blur(8px) brightness(98%) opacity(95%)',
                        }"
                      ></div>
                    </div>
                  </a-tooltip>
                  <a-tooltip placement="top" content="复古">
                    <div class="filter-item" @click="selectFilter('vintage')">
                      <div
                        class="filter-preview"
                        :class="{ active: selectedFilter === 'vintage' }"
                        :style="{
                          backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                          filter:
                            'sepia(60%) contrast(115%) brightness(95%) saturate(85%) hue-rotate(-10deg) ',
                        }"
                      ></div>
                    </div>
                  </a-tooltip>
                  <a-tooltip placement="top" content="重置">
                    <div class="filter-item" @click="selectFilter('reset')">
                      <div
                        class="filter-preview"
                        :class="{ active: selectedFilter === 'reset' }"
                        :style="{
                          backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                          filter: 'none',
                        }"
                      ></div>
                    </div>
                  </a-tooltip>
                </div>
          </div>
        </div> -->
      </template>

      <!-- Delete -->
      <div class="tool-item">
        <div class="divider"></div>
        <a-tooltip placement="top" content="删除">
          <a-button size="mini" status="danger" type="text" @click="handleDelete">
            <icon-delete />
          </a-button>
        </a-tooltip>
      </div>
    </div>
  </template>

  <script setup lang="ts">
  import { computed} from 'vue';
  import { useCanvasStore } from '@/store/canvasStore';
  import { NodeType,type ShapeState, type TextState } from '@/types/state';
  import { worldToClient } from '@/core/utils/geometry';
  // import { DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_URL } from '@/config/defaults';
  import {
    Delete as IconDelete,
    TextBold as IconTextBold,
    TextItalic as IconTextItalic,
    TextUnderline as IconTextUnderline,
    Strikethrough as IconStrikethrough,
    BringToFrontOne as IconBringToFront,
    SentToBack as IconSendToBack,
    Layers as IconLayers, // 新增图标
  Text as IconText,     // 新增图标
  } from '@icon-park/vue-next';

  const store = useCanvasStore();

  // 获取当前选中的第一个节点（ContextToolbar 仅在单选时显示）
  const activeNode = computed(() => {
    const ids = Array.from(store.activeElementIds);
    if (ids.length !== 1) return null;
    return store.nodes[ids[0]!];
  });
  const isGroup = computed(() => activeNode.value?.type === NodeType.GROUP);

  // 显示条件：有且仅有一个选中节点，并且不在其他交互中（如拖拽）
  const isVisible = computed(() => !!activeNode.value && !store.isInteracting && !isGroup.value);

  // 计算属性工具栏在屏幕中的位置，用 worldToClient 将世界坐标转换为 DOM 客户端坐标 
  // 说明：由于 ContextToolbar 本身放在视口外层 (不受 viewport transform)，因此需要将节点的世界坐标映射到 client 坐标
  // 计算工具栏在页面中的绝对位置：以节点的中心为锚点向上偏移
  const positionStyle = computed(() => {
    if (!activeNode.value) return {};

    const node = activeNode.value;
    const { x, y, width } = node.transform;

    // 计算节点在屏幕上的位置（相对于 CanvasStage 容器）
    const worldCenter = {
      x: x + width / 2,
      y: y,
    };

    const clientPos = worldToClient(store.viewport, worldCenter.x, worldCenter.y);

    return {
      top: `${clientPos.y - 12}px`,
      left: `${clientPos.x}px`,
      transform: 'translate(-50%, -100%)', // 居中并向上偏移
    };
  });

  // 类型判断
  const isShape = computed(() => {
    return activeNode.value?.type === NodeType.RECT || activeNode.value?.type === NodeType.CIRCLE;
  });

  const isText = computed(() => {
    return activeNode.value?.type === NodeType.TEXT;
  });

  const isImage = computed(() => {
    return activeNode.value?.type === NodeType.IMAGE;
  });

  // --- Common Actions (对选中节点的操作，例如置于最前 / 置于最底 / 删除) ---
  const opacity = computed({
    get: () => activeNode.value?.style.opacity ?? 1,
    set: (val) => {
      if (activeNode.value) {
        store.updateNode(activeNode.value.id, {
          style: { ...activeNode.value.style, opacity: val as number },
        });
      }
    },
  });

  const bringToFront = () => {
    if (!activeNode.value) return;
    const id = activeNode.value.id;
    const order = [...store.nodeOrder];
    const index = order.indexOf(id);
    if (index > -1) {
      order.splice(index, 1);
      order.push(id);
      store.nodeOrder = order;
      store.version++;
    }
  };

  const sendToBack = () => {
    if (!activeNode.value) return;
    const id = activeNode.value.id;
    const order = [...store.nodeOrder];
    const index = order.indexOf(id);
    if (index > -1) {
      order.splice(index, 1);
      order.unshift(id);
      store.nodeOrder = order;
      store.version++;
    }
  };

  // --- Shape Actions ---
  const fillColor = computed({
    get: () => (activeNode.value as ShapeState)?.style.backgroundColor || '#000000',
    set: (val) =>
      store.updateNode(activeNode.value!.id, {
        style: { ...activeNode.value!.style, backgroundColor: val },
      }),
  });

  const strokeColor = computed({
    get: () => (activeNode.value as ShapeState)?.style.borderColor || '#000000',
    set: (val) =>
      store.updateNode(activeNode.value!.id, {
        style: { ...activeNode.value!.style, borderColor: val },
      }),
  });

  const strokeWidth = computed({
    get: () => (activeNode.value as ShapeState)?.style.borderWidth || 0,
    set: (val) =>
      store.updateNode(activeNode.value!.id, {
        style: { ...activeNode.value!.style, borderWidth: val as number },
      }),
  });

  // --- Text Actions ---
  // 1. 安全获取当前文本节点 (Computed)
  // 这样后面就不用每次都写 (activeNode.value as TextState) 了
  const activeTextNode = computed(() => {
    const node = store.activeElements[0];
    if (node?.type === NodeType.TEXT) {
      return node as TextState;
    }
    return null;
  });

  // --- 具体的属性绑定 ---

  const fontSize = computed({
    get: () => activeTextNode.value?.props.fontSize || 14,
    set: (val) =>
      activeTextNode.value &&
      store.updateNode(activeTextNode.value.id, {
        props: { fontSize: val as number },
      } as Partial<TextState>),
  });

  const textColor = computed({
    get: () => activeTextNode.value?.props.color || '#000000',
    set: (val) =>
      activeTextNode.value &&
      store.updateNode(activeTextNode.value.id, {
        props: { color: val as string },
      } as Partial<TextState>),
  });

  // --- 样式开关 (Toggle) ---

  const isBold = computed(() => {
    const fw = activeTextNode.value?.props.fontWeight || 400;
    return fw >= 700;
  });
  const toggleBold = () => {
    // 如果当前是粗体，设为 400，否则设为 700
    if (!activeTextNode.value) return;
    store.updateNode(activeTextNode.value.id, {
      props: { fontWeight: isBold.value ? 400 : 700 },
    } as Partial<TextState>);
  };

  const isItalic = computed(() => activeTextNode.value?.props.fontStyle === 'italic');
  const toggleItalic = () => {
    if (!activeTextNode.value) return;
    store.updateNode(activeTextNode.value.id, {
      props: { fontStyle: isItalic.value ? 'normal' : 'italic' },
    } as Partial<TextState>);
  };

  const isUnderline = computed(() => activeTextNode.value?.props.underline || false);
  const toggleUnderline = () => {
    if (!activeTextNode.value) return;
    store.updateNode(activeTextNode.value.id, {
      props: { underline: !isUnderline.value },
    } as Partial<TextState>);
  };

  const isStrikethrough = computed(() => activeTextNode.value?.props.strikethrough || false);
  const toggleStrikethrough = () => {
    if (!activeTextNode.value) return;
    store.updateNode(activeTextNode.value.id, {
      props: { strikethrough: !isStrikethrough.value },
    } as Partial<TextState>);
  };

  const handleDelete = () => {
    if (activeNode.value) {
      store.deleteNode(activeNode.value.id);
    }
  };

  // 选择滤镜
  // const selectedFilter = ref<string | null>(null);
  // const selectFilter = (filterType: string) => {
  //   selectedFilter.value = filterType;

  //   switch (filterType) {
  //     case 'grayscale':
  //       grayscaleFilter();
  //       break;
  //     case 'blur':
  //       blurFilter();
  //       break;
  //     case 'vintage':
  //       vintageFilter();
  //       break;
  //     case 'reset':
  //       resetFilter();
  //       break;
  //   }
  // };
  // const grayscaleFilter = () => {
  //   store.activeElements.forEach((element) => {
  //     if (element && element.id && element.type === 'image') {
  //       store.updateNode(element.id, {
  //         props: {
  //           ...element.props,
  //           filters: {
  //             grayscale: 100,
  //             contrast: 110,
  //             brightness: 95,
  //           },
  //         },
  //       });
  //     }
  //   });
  // };

  // const blurFilter = () => {
  //   store.activeElements.forEach((element) => {
  //     if (element && element.id && element.type === 'image') {
  //       store.updateNode(element.id, {
  //         props: {
  //           ...element.props,
  //           filters: {
  //             blur: 8,
  //             brightness: 98,
  //             filterOpacity: 95,
  //           },
  //         },
  //       });
  //     }
  //   });
  // };

  // const vintageFilter = () => {
  //   store.activeElements.forEach((element) => {
  //     if (element && element.id && element.type === 'image') {
  //       store.updateNode(element.id, {
  //         props: {
  //           ...element.props,
  //           filters: {
  //             sepia: 60, // 棕褐色调
  //             contrast: 115, // 增强对比度
  //             brightness: 95, // 降低亮度
  //             saturate: 85, // 降低饱和度
  //             hueRotate: -10, // 轻微色相偏移
  //           },
  //         },
  //       });
  //     }
  //   });
  // };

  // const resetFilter = () => {
  //   store.activeElements.forEach((element) => {
  //     if (element && element.id && element.type === 'image') {
  //       store.updateNode(element.id, {
  //         props: {
  //           ...element.props,
  //           filters: DEFAULT_IMAGE_FILTERS,
  //         },
  //       });
  //     }
  //   });
  // };
  // // 预览图片（可以使用当前选中图片的缩略图）
  // const previewImage = computed(() => {
  //   // 这里可以返回当前选中图片的URL
  //   return (activeNode.value as ImageState)?.props?.imageUrl || DEFAULT_IMAGE_URL;
  // });

  // // 默认预览图片（当没有选中图片时使用）
  // const defaultImage = DEFAULT_IMAGE_URL;
  </script>

  <style scoped>
  .context-toolbar {
    position: absolute;
    z-index: 1000;
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background-color: var(--color-bg-2); /* 白色背景 */
    border-radius: 8px; /* 圆角矩形 */
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); /* 柔和阴影 */
    gap: 8px;
    pointer-events: auto;
    border: 1px solid var(--color-border-2);
  }

  .tool-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tool-item {
    display: flex;
    align-items: center;
  }

  .label {
    font-size: 12px;
    color: var(--color-text-2);
    margin-right: 4px;
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--color-border-2);
  }

  .filter-options {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .filter-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  }
  .filter-preview {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background-size: cover;
    background-position: center;
    border: 2px solid #e5e5e5;
    transition: all 0.2s ease;
  }
  .filter-preview.active {
    border-color: #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
  .filter-name {
    margin-top: 4px;
    font-size: 12px;
    color: #666;
  }
  .layer-popover {
  padding: 8px !important; /* 调整内边距 */
  min-width: 120px; /* 固定最小宽度，避免文字挤压 */
}

/* 提示文字样式 */
.popover-tip {
  text-align: center; /* 文字居中 */
  font-size: 12px; /* 字号适配 mini 按钮 */
  color: #666; /* 浅灰色，区分按钮文字 */
  padding: 0 0 6px 0; /* 与按钮保持间距 */
  border-bottom: 1px solid #f0f0f0; /* 加分割线，视觉更清晰 */
  margin-bottom: 6px;
}

/* 按钮行样式优化 */
.popover-row {
  display: flex;
  flex-direction: column; /* 按钮垂直排列 */
  gap: 4px; /* 按钮之间的间距 */
}
  </style>
