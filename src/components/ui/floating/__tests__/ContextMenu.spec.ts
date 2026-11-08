import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { Notification } from '@arco-design/web-vue';
import ContextMenu from '../ContextMenu.vue';
import { ToolManager } from '@/core/ToolManager';
import { NodeFactory } from '@/core/services/NodeFactory';
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';

describe('context menu paste', () => {
  let wrapper: VueWrapper;
  let stage: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.spyOn(Notification, 'success').mockImplementation(() => ({ close: vi.fn() }));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return this.classList.contains('test-stage')
        ? new DOMRect(120, 80, 800, 600)
        : new DOMRect(0, 0, 180, 300);
    });
    stage = document.createElement('div');
    stage.className = 'test-stage';
    document.body.append(stage);
    const slot = { template: '<div><slot /></div>' };
    wrapper = mount(ContextMenu, {
      global: {
        stubs: {
          'a-menu': slot,
          'a-menu-item': { template: '<button><slot /></button>' },
          'a-button': { template: '<button><slot /></button>' },
          'a-button-group': slot,
          'a-divider': true,
          'a-sub-menu': true,
          'a-modal': true,
        },
      },
    });
  });

  afterEach(() => {
    wrapper.unmount();
    stage.remove();
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    'uses the right-click location with selection=%s even when the menu moves',
    async (hasSelection) => {
      const store = useCanvasStore();
      const selection = useSelectionStore();
      const source = NodeFactory.createRect(10, 20);
      store.addNode(source);
      selection.setActive([source.id]);
      store.copySelected();
      if (!hasSelection) selection.clearSelection();
      Object.assign(store.viewport, { zoom: 2, offsetX: 40, offsetY: -20 });
      const manager = new ToolManager(stage, () => false);
      const handler = (event: MouseEvent) => {
        if (hasSelection) manager.handleNodeContextMenu(event);
        else manager.handleContextMenu(event);
      };
      stage.addEventListener('contextmenu', handler);
      stage.dispatchEvent(new MouseEvent('contextmenu', { clientX: 1000, clientY: 750 }));
      await nextTick();
      await nextTick();
      const menu = document.querySelector<HTMLElement>('.right-click-menu')!;
      expect(parseFloat(menu.style.left)).toBeLessThan(1000);
      expect(parseFloat(menu.style.top)).toBeLessThan(750);
      const paste = hasSelection
        ? menu.querySelector<HTMLButtonElement>('button[title="粘贴"]')!
        : [...menu.querySelectorAll('button')].find((button) =>
            button.textContent?.includes('粘贴')
          )!;
      paste.click();
      await nextTick();
      const pasted = store.nodes[[...selection.activeElementIds][0]!]!;
      expect(pasted.id).not.toBe(source.id);
      expect(pasted.transform).toMatchObject({ x: 420, y: 345 });
      expect(document.querySelector('.right-click-menu')).toBeNull();
      manager.destroy();
    }
  );
});
