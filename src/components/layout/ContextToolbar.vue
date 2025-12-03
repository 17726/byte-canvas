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
          :min="12"
          :max="100"
          style="width: 50px;margin-left: 2px;"
          hide-button
          @change="handleFontSizeChange"
        />
      </div>
      <div class="tool-item">
        <a-tooltip placement="top" content="加粗">
          <a-button size="mini" :type="isBold ? 'primary' : 'text'" @click="handleToggleBold">
            <icon-text-bold />
          </a-button>
        </a-tooltip>
      </div>
      <div class="tool-item">
        <a-tooltip placement="top" content="倾斜">
          <a-button size="mini" :type="isItalic ? 'primary' : 'text'" @click="handleToggleItalic">
            <icon-text-italic />
          </a-button>
        </a-tooltip>
      </div>
      <div class="tool-item">
        <a-tooltip placement="top" content="下划线">
            <a-button size="mini" :type="isUnderline ? 'primary' : 'text'" @click="handleToggleUnderline">
              <icon-text-underline />
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
        <a-tooltip placement="top" content="删除线">
          <a-button size="mini" :type="isStrikethrough ? 'primary' : 'text'" @click="handleToggleStrikeThrough">
            <icon-strikethrough />
          </a-button>
        </a-tooltip>
      </div>
      <div class="tool-item">
        <a-color-picker size="mini" v-model="textColor" trigger="hover" @input="handleColorChange" />
      </div>
    </template>

  // 显示条件：有且仅有一个选中节点，并且不在其他交互中（如拖拽）
  const isVisible = computed(() => !!activeNode.value && !store.isInteracting && !isGroup.value);

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
import { computed,ref } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type ImageState,type InlineStyleProps,type ShapeState, type TextDecorationValue, type TextState } from '@/types/state';
import { worldToClient } from '@/core/utils/geometry';
import { DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_URL } from '@/config/defaults';
import {
  Delete as IconDelete,
  TextBold as IconTextBold,
  TextItalic as IconTextItalic,
  TextUnderline as IconTextUnderline,
  Strikethrough as IconStrikethrough,
  BringToFrontOne as IconBringToFront,
  SentToBack as IconSendToBack,
} from '@icon-park/vue-next';

const store = useCanvasStore();

// 获取当前选中的第一个节点（ContextToolbar 仅在单选时显示）
const activeNode = computed(() => {
  const ids = Array.from(store.activeElementIds);
  if (ids.length !== 1) return null;
  return store.nodes[ids[0]!];
});

// 显示条件：有且仅有一个选中节点，并且不在其他交互中（如拖拽）
const isVisible = computed(() => !!activeNode.value && !store.isInteracting);

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

// 2. 从 Pinia 获取全局选区（与激活节点对应）
const globalTextSelection = computed(() => {
  console.log('工具栏获取全局选区：', store.globalTextSelection);
  return store.globalTextSelection;
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
const isItalic = computed(() => activeTextNode.value?.props.fontStyle === 'italic');
const isUnderline = computed(() => activeTextNode.value?.props.textDecoration?.includes('underline') || false);
const isStrikethrough = computed(() => activeTextNode.value?.props.textDecoration?.includes('line-through') || false);

// 工具函数：添加/移除部分文本样式（修改依赖为全局状态）
// 工具栏组件：优化 toggleInlineStyle 函数
const toggleInlineStyle = (
  styleKey: keyof InlineStyleProps,
  value: InlineStyleProps[keyof InlineStyleProps]
) => {
  if (!activeTextNode.value || !globalTextSelection.value) {
    console.warn('请先选中需要格式化的文本');
    return;
  }

  const { start, end } = globalTextSelection.value;
  const newInlineStyles = [...(activeTextNode.value.props.inlineStyles || [])];

  // 关键：按选区+样式Key查找（而非全量匹配），支持同一选区添加多个样式
  const existingIndex = newInlineStyles.findIndex(
    s => s.start === start && s.end === end && s.styles.hasOwnProperty(styleKey)
  );

  if (existingIndex !== -1) {
    // 情况1：已存在该样式 → 仅移除该样式属性
    const styleEntry = newInlineStyles[existingIndex];
    if (styleEntry && styleEntry.styles && styleEntry.styles.hasOwnProperty(styleKey)) {
      delete styleEntry.styles[styleKey];
      // 如果该选区已无样式，则移除整个 entry
      if (Object.keys(styleEntry.styles).length === 0) {
        newInlineStyles.splice(existingIndex, 1);
      }
    }
  } else {
    // 情况2：不存在该样式 → 添加（合并到同一选区）
    newInlineStyles.push({ start, end, styles: { [styleKey]: value } });
  }

  store.updateNode(activeTextNode.value.id, {
    props: { ...activeTextNode.value.props, inlineStyles: newInlineStyles }
  });
};

// 加粗切换
const handleToggleBold = () => {
  if (!activeTextNode.value) return;
  const currentWeight = activeTextNode.value.props.fontWeight;
  toggleInlineStyle('fontWeight', currentWeight === 700 ? 400 : 700);
};

// 斜体切换
const handleToggleItalic = () => {
  if (!activeTextNode.value) return;
  const currentStyle = activeTextNode.value.props.fontStyle;
  toggleInlineStyle('fontStyle', currentStyle === 'italic' ? 'normal' : 'italic');
};

// 下划线切换（核心：通过值组合/移除实现单独切换）
const handleToggleUnderline = () => {
  if (!activeTextNode.value || !store.globalTextSelection) return;

  const currentDecoration = getCurrentTextDecoration();
  let newDecoration: TextDecorationValue = 'none';

  if (currentDecoration.includes('underline')) {
    // 情况1：已有下划线 → 移除（保留其他装饰）
    newDecoration = currentDecoration
      .split(' ')
      .filter(part => part !== 'underline')
      .join(' ') as TextDecorationValue;
    // 若移除后为空，设为 'none'
    newDecoration = newDecoration || 'none';
  } else {
    // 情况2：无下划线 → 添加（叠加其他装饰）
    newDecoration = currentDecoration === 'none'
      ? 'underline'
      : `${currentDecoration} underline` as TextDecorationValue;
  }

  // 调用 toggleInlineStyle，styleKey 为 'textDecoration'，值为新的组合
  toggleInlineStyle('textDecoration', newDecoration);
};

// 删除线切换（逻辑与下划线一致）
const handleToggleStrikeThrough = () => {
  if (!activeTextNode.value || !store.globalTextSelection) return;

  const currentDecoration = getCurrentTextDecoration();
  let newDecoration: TextDecorationValue = 'none';

  if (currentDecoration.includes('line-through')) {
    // 移除删除线
    newDecoration = currentDecoration
      .split(' ')
      .filter(part => part !== 'line-through')
      .join(' ') as TextDecorationValue;
    newDecoration = newDecoration || 'none';
  } else {
    // 添加删除线
    newDecoration = currentDecoration === 'none'
      ? 'line-through'
      : `${currentDecoration} line-through` as TextDecorationValue;
  }

  toggleInlineStyle('textDecoration', newDecoration);
};



// 字体选择(稍后实现)
// const handleFontFamilyChange = (e: Event) => {
//   const target = e.target as HTMLSelectElement;
//   const fontFamily = target.value.trim(); // 去除空格，避免空字符串

//   // 校验：有激活节点 + 有选区 + 字体值有效
//   if (!activeTextNode.value || !globalTextSelection.value || !fontFamily) {
//     target.value = ''; // 重置下拉框
//     return;
//   }

//   // 调用工具函数添加/移除字体样式
//   toggleInlineStyle('fontFamily', fontFamily);
//   target.value = ''; // 重置下拉框，提升用户体验
// };

// 字号选择
const handleFontSizeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  const fontSize = Number(target.value);

  // 校验：有激活节点 + 有选区 + 字号是有效数字（8-48px 范围）
  if (
    !activeTextNode.value ||
    !globalTextSelection.value ||
    isNaN(fontSize) ||
    fontSize < 8 ||
    fontSize > 48
  ) {
    target.value = ''; // 重置下拉框
    return;
  }

  // 调用工具函数添加/移除字号样式
  toggleInlineStyle('fontSize', fontSize);
  target.value = ''; // 重置下拉框
};

// 颜色选择
const handleColorChange = (color: string) => {
  // 无激活文本节点 → 直接返回
  if (!activeTextNode.value) {
    console.warn('请先选中文本节点再设置颜色');
    return;
  }

  // 更新文本节点的全局 color 属性（同步到 store）
  store.updateNode(activeTextNode.value.id, {
    props: {
      ...activeTextNode.value.props,
      color: color // 直接赋值验证后的有效颜色
    }
  });
};

// 辅助函数：获取选中文本的当前 textDecoration 状态（行内样式优先，无则取全局）
const getCurrentTextDecoration = (): TextDecorationValue => {
  const { globalTextSelection } = store;
  if (!activeTextNode.value || !globalTextSelection) return 'none';

  const { start, end } = globalTextSelection;
  const { inlineStyles, textDecoration: globalDecoration } = activeTextNode.value.props;

  // 1. 先找行内样式（选中范围的 textDecoration）
  const targetInlineStyle = inlineStyles?.find(s => s.start === start && s.end === end);
  if (targetInlineStyle?.styles.textDecoration) {
    return targetInlineStyle.styles.textDecoration;
  }

  // 2. 无行内样式则取全局样式
  return globalDecoration || 'none';
};

const handleDelete = () => {
  if (activeNode.value) {
    store.deleteNode(activeNode.value.id);
  }
};

// 选择滤镜
const selectedFilter = ref<string | null>(null);
const selectFilter = (filterType: string) => {
  selectedFilter.value = filterType;

  switch (filterType) {
    case 'grayscale':
      grayscaleFilter();
      break;
    case 'blur':
      blurFilter();
      break;
    case 'vintage':
      vintageFilter();
      break;
    case 'reset':
      resetFilter();
      break;
  }
};
const grayscaleFilter = () => {
  store.activeElements.forEach((element) => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            grayscale: 100,
            contrast: 110,
            brightness: 95,
          },
        },
      });
    }
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
