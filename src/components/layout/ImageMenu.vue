<template>
  <a-sub-menu key="addImage" @mouseenter="handleImageMenuEnter">
    <template #icon><icon-image /></template>
    <template #title>图片</template>
  <!-- 图片选择网格 - 延迟加载 -->
  <!-- 只有当 isImageMenuLoaded 为 true 时，这个 div 和其内容才会被渲染到 DOM 中 -->
  <div v-if="isImageMenuLoaded" class="image-selector">
    <div class="image-grid" @click="handleImageGridClick">
      <div
        v-for="(image, index) in visibleImages"
        :key="image.id"
        class="image-item"
        :data-image-url="image.url"
        :data-image-index="index"
      >
        <!-- 使用 img 标签替代 background-image 支持原生懒加载-->
        <img
          :src="getOptimizedThumbnail(image)"
          :alt="image.name"
          width="60"
          height="60"
          loading="lazy"
          class="image-preview"
          @load="handleImageLoad"
          @error="handleImageError"
        />
        <span class="image-name">{{ image.name }}</span>
      </div>

      <!-- 懒加载占位符 -->
      <div
        v-for="n in remainingPlaceholders"
        :key="`placeholder-${n}`"
        class="image-item image-placeholder"
        :data-lazy-index="visibleImages.length + n - 1"
      >
        <div class="image-preview placeholder"></div>
        <span class="image-name">加载中...</span>
      </div>
    </div>
  </div>
  <div v-else class="menu-loading">
    加载图片库...
  </div>
  </a-sub-menu>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { IconImage } from '@arco-design/web-vue/es/icon';
import { ToolManager } from '@/core/tools/ToolManager';
import { DEFAULT_IMAGE_URL } from '@/config/defaults';
// 导入图片库配置和类型
import imageLibraryConfig, { type ImageItem } from '@/config/imageLibrary';

const toolManager = new ToolManager(null);

// 响应式数据
const isImageMenuLoaded = ref(false);
const visibleImages = ref<ImageItem[]>([]);
const loadedImageIndexes = ref<Set<number>>(new Set());
const imageObserver = ref<IntersectionObserver | null>(null);
let loadTimeout: ReturnType<typeof setTimeout> | null = null;

// 使用导入的图片库配置
const imageLibrary = ref<ImageItem[]>([...imageLibraryConfig]);

// 可见图片数量控制
const initialLoadCount = 22; // 现在加载22张 没什么负担 如果需要优化再改这里
const lazyLoadCount = 6;    // 以后每次懒加载6张

//NOTE: 懒加载占位符数量计算
const remainingPlaceholders = computed(() => {
  // 1. 获取图片库总数量
  const total = imageLibrary.value.length;
  // 2. 获取当前已加载的图片数量
  const loaded = visibleImages.value.length;
  // 3. 计算剩余需要显示的占位符数量，确保不为负数
  return Math.max(0, total - loaded);
});

//NOTE: 图片菜单鼠标进入事件 - 延迟加载 避免快速划过时也加载图片造成资源浪费
const handleImageMenuEnter = () => {
  // 如果已经加载过了，直接返回，避免重复加载
  if (isImageMenuLoaded.value) return;

  // 设置延迟加载定时器
  loadTimeout = setTimeout(() => {
    // 标记菜单内容已加载
    isImageMenuLoaded.value = true;
    // 初始加载部分图片（前9张）
    visibleImages.value = imageLibrary.value.slice(0, initialLoadCount);
    // 设置懒加载机制，准备加载剩余图片
    setupLazyLoading();
  }, 100);// 延迟100毫秒执行
};

const getOptimizedThumbnail = (image: ImageItem) => {
  // 优先返回缩略图，如果没有就返回原图
  return image.thumbnail || image.url;
};

// 设置懒加载观察器
const setupLazyLoading = () => {
  if (!window.IntersectionObserver) {
    // 浏览器不支持 IntersectionObserver，直接加载所有图片
    visibleImages.value = [...imageLibrary.value];
    return;
  }

  imageObserver.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 将 entry.target 断言为 HTMLElement 以访问 dataset
        const target = entry.target as HTMLElement;
        const lazyIndex = parseInt(target.dataset.lazyIndex || '0');
        loadLazyImage(lazyIndex);
        if (imageObserver.value) {
          imageObserver.value.unobserve(entry.target);
        }
      }
    });
  }, {
    rootMargin: '50px', // 提前50px开始加载
    threshold: 0.1
  });

  // 延迟观察，确保DOM已更新
  setTimeout(() => {
    document.querySelectorAll('.image-placeholder').forEach(el => {
      if (imageObserver.value) {
        imageObserver.value.observe(el);
      }
    });
  }, 50);
};

// 懒加载图片
const loadLazyImage = (index: number) => {
  if (index >= imageLibrary.value.length || loadedImageIndexes.value.has(index)) {
    return;
  }

  // 分批加载，避免一次性加载太多
  const startIndex = Math.floor(index / lazyLoadCount) * lazyLoadCount;
  const endIndex = Math.min(startIndex + lazyLoadCount, imageLibrary.value.length);

  const newImages = imageLibrary.value.slice(startIndex, endIndex);
  newImages.forEach((image, i) => {
    const actualIndex = startIndex + i;
    if (!loadedImageIndexes.value.has(actualIndex)) {
      loadedImageIndexes.value.add(actualIndex);
      // 使用 setTimeout 分散加载压力
      setTimeout(() => {
        if (!visibleImages.value.includes(image)) {
          visibleImages.value.push(image);
        }
      }, i * 50); // 每张图片间隔50ms加载
    }
  });
};

// 图片网格点击事件 - 事件委托 通过单个事件监听器处理多个子元素的点击事件，而不是为每个子元素单独绑定事件
const handleImageGridClick = (event: Event) => {
  console.log("图片被点击")
  // 1. 找到实际被点击的 .image-item 元素
  const imageItem = (event.target as HTMLElement).closest('.image-item');
  // 2. 如果点击的不是图片项，直接返回(点击了空白区域)
  if (!imageItem) return;
  // 3. 从 data 属性中获取图片URL
  const imageUrl =(imageItem as HTMLElement).dataset.imageUrl;
  // 4. 如果有URL，调用创建图片的函数
  if (imageUrl) {
    console.log("url:"+imageUrl);
    toolManager.createImageWithUrl(imageUrl);
  }else{
    console.log("创建默认图片");
    toolManager.createImageWithUrl(DEFAULT_IMAGE_URL);
  }
};

// 图片加载成功
const handleImageLoad = (event: Event) => {
  (event.target as HTMLImageElement).classList.add('loaded'); // 添加加载完成样式
};

// 图片加载失败
const handleImageError = (event: Event) => {
  console.warn('图片加载失败:', (event.target as HTMLImageElement).src);
  (event.target as HTMLImageElement).style.display = 'none'; // 隐藏损坏的图片
  // 或者可以显示一个占位图
};

// 清理
onUnmounted(() => {
  if (loadTimeout) clearTimeout(loadTimeout);
  if (imageObserver.value) {
    imageObserver.value.disconnect();
  }
});

</script>
<style scoped>
/* 隐藏 Arco Design 默认滚动条 */
:deep(.no-scroll-submenu .arco-menu-pop) {
  overflow: hidden !important;
}

.image-selector {
  max-width: 300px;
  overflow-y: auto;  /* 内部滚动 */
  padding: 8px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 6px 4px;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.image-item:hover {
  background-color: #f0f0f0;
}

.image-preview {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  object-fit: cover; /* 关键：保持图片比例 */
  border: 1px solid #e5e5e5;
  transition: border-color 0.15s ease;
  opacity: 0; /* 初始透明 */
  transition: opacity 0.2s ease;
}

/* 图片加载完成后的样式 */
.image-preview.loaded {
  opacity: 1; /* 渐入效果 */
}

.image-name {
  margin-top: 4px;
  font-size: 11px;
  color: #666;
  text-align: center;
  word-break: break-word;
  max-width: 70px;
  line-height: 1.3;
}
/* 占位符样式 */
.image-placeholder {
  pointer-events: none; /* 防止误点击 */
}

.image-placeholder .placeholder {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.menu-loading {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 12px;
}
</style>