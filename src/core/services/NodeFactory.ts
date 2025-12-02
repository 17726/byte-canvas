/**
 * @file NodeFactory.ts
 * @description 节点工厂服务
 *
 * 本文件负责创建各类节点的数据结构 (Data Objects)，遵循工厂模式。
 *
 * 特点：
 * 1. 纯函数设计：仅返回节点对象，不涉及 Store 操作或副作用
 * 2. 类型安全：所有方法都有明确的返回类型声明
 * 3. 可测试性：工厂方法独立于 UI 和状态管理，便于单元测试
 * 4. 单一职责：仅负责节点数据的初始化，不处理添加到画布的逻辑
 *
 * 包含方法列表：
 * - createRect: 创建矩形节点数据
 * - createCircle: 创建圆形节点数据
 * - createText: 创建文本节点数据
 * - createImage: 创建图片节点数据（需要异步获取图片尺寸）
 * - getImageDimensions: 获取图片原始尺寸（辅助方法）
 */

import { v4 as uuidv4 } from 'uuid';
import { NodeType, type ShapeState, type TextState, type ImageState } from '@/types/state';
import {
  DEFAULT_NODE_SIZE,
  DEFAULT_RECT_STYLE,
  DEFAULT_RECT_PROPS,
  DEFAULT_CIRCLE_STYLE,
  DEFAULT_CIRCLE_PROPS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TEXT_PROPS,
  DEFAULT_TEXT_SIZE,
  DEFAULT_IMAGE_STYLE,
  DEFAULT_IMAGE_URL,
  DEFAULT_IMAGE_FILTERS,
} from '@/config/defaults';

/**
 * 节点工厂类
 * 负责创建各类节点的数据结构
 */
export class NodeFactory {
  /**
   * 创建矩形节点
   * @param x 节点 X 坐标（可选，默认随机）
   * @param y 节点 Y 坐标（可选，默认随机）
   * @returns 矩形节点数据对象
   */
  static createRect(x?: number, y?: number): ShapeState {
    const id = uuidv4();
    const posX = x ?? Math.random() * 800;
    const posY = y ?? Math.random() * 600;

    return {
      id,
      type: NodeType.RECT,
      name: 'Rectangle',
      transform: {
        x: posX,
        y: posY,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_RECT_STYLE },
      props: { ...DEFAULT_RECT_PROPS },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'rect',
    };
  }

  /**
   * 创建圆形节点
   * @param x 节点 X 坐标（可选，默认随机）
   * @param y 节点 Y 坐标（可选，默认随机）
   * @returns 圆形节点数据对象
   */
  static createCircle(x?: number, y?: number): ShapeState {
    const id = uuidv4();
    const posX = x ?? Math.random() * 800;
    const posY = y ?? Math.random() * 600;

    return {
      id,
      type: NodeType.CIRCLE,
      name: 'Circle',
      transform: {
        x: posX,
        y: posY,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_CIRCLE_STYLE },
      props: { ...DEFAULT_CIRCLE_PROPS },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'circle',
    };
  }

  /**
   * 创建文本节点
   * @param x 节点 X 坐标（可选，默认随机）
   * @param y 节点 Y 坐标（可选，默认随机）
   * @returns 文本节点数据对象
   */
  static createText(x?: number, y?: number): TextState {
    const id = uuidv4();
    const posX = x ?? Math.random() * 800;
    const posY = y ?? Math.random() * 600;

    return {
      id,
      type: NodeType.TEXT,
      name: 'Text',
      transform: {
        x: posX,
        y: posY,
        width: DEFAULT_TEXT_SIZE.width,
        height: DEFAULT_TEXT_SIZE.height,
        rotation: 0,
      },
      style: { ...DEFAULT_TEXT_STYLE },
      props: { ...DEFAULT_TEXT_PROPS },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };
  }

  /**
   * 创建图片节点（异步方法，会尝试获取图片原始尺寸）
   * @param imageUrl 图片 URL（可选，默认使用配置中的默认图片）
   * @param x 节点 X 坐标（可选，默认随机）
   * @param y 节点 Y 坐标（可选，默认随机）
   * @returns 图片节点数据对象（异步）
   */
  static async createImage(
    imageUrl: string = DEFAULT_IMAGE_URL,
    x?: number,
    y?: number
  ): Promise<ImageState> {
    const id = uuidv4();
    const posX = x ?? Math.random() * 800;
    const posY = y ?? Math.random() * 600;

    try {
      // 获取图片原始尺寸
      const dimensions = await NodeFactory.getImageDimensions(imageUrl);

      // 尺寸限制常量
      const MAX_SIZE = 400;
      const MIN_SIZE = 50;

      let { width, height } = dimensions;

      // 如果图片太大，等比例缩放
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // 确保不小于最小尺寸
      if (width < MIN_SIZE || height < MIN_SIZE) {
        const ratio = Math.max(MIN_SIZE / width, MIN_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      return {
        id,
        type: NodeType.IMAGE,
        name: 'Image',
        transform: {
          x: posX,
          y: posY,
          width,
          height,
          rotation: 0,
        },
        style: { ...DEFAULT_IMAGE_STYLE },
        props: {
          imageUrl,
          filters: { ...DEFAULT_IMAGE_FILTERS },
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
      };
    } catch (error) {
      console.warn('获取图片尺寸失败，使用默认尺寸:', error);
      // 降级方案：使用默认尺寸
      return NodeFactory.createImageWithDefaultSize(id, imageUrl, posX, posY);
    }
  }

  /**
   * 获取图片原始尺寸（辅助方法）
   * @param url 图片 URL
   * @returns 图片的宽高信息
   */
  static getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let resolved = false;

      img.onload = () => {
        if (!resolved) {
          resolved = true;
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        }
      };

      img.onerror = () => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`图片加载失败: ${url}`));
        }
      };

      // 设置超时（5 秒）
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          img.onload = null;
          img.onerror = null;
          reject(new Error(`图片加载超时: ${url}`));
        }
      }, 5000);

      img.src = url;
    });
  }

  /**
   * 创建图片节点（使用默认尺寸，降级方案）
   * @param id 节点 ID（外部传入，避免重复生成）
   * @param imageUrl 图片 URL
   * @param x 节点 X 坐标
   * @param y 节点 Y 坐标
   * @returns 图片节点数据对象
   */
  private static createImageWithDefaultSize(
    id: string,
    imageUrl: string,
    x: number,
    y: number
  ): ImageState {
    return {
      id,
      type: NodeType.IMAGE,
      name: 'Image',
      transform: {
        x,
        y,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_IMAGE_STYLE },
      props: {
        imageUrl,
        filters: { ...DEFAULT_IMAGE_FILTERS },
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };
  }
}
