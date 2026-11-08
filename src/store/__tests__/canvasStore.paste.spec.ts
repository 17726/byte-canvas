import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { NodeFactory } from '@/core/services/NodeFactory';
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import { useHistoryStore } from '@/store/historyStore';
import { loadClipboard } from '@/store/persistence';

describe('paste position', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  function copyNodes() {
    const store = useCanvasStore();
    const selection = useSelectionStore();
    const first = NodeFactory.createRect(100, 200);
    const second = NodeFactory.createCircle(250, 150);
    store.addNode(first);
    store.addNode(second);
    selection.setActive([first.id, second.id]);
    store.copySelected();
    return { store, selection, first, second };
  }

  it('places the selection at the target and preserves relative positions and clipboard data', () => {
    const { store, selection, first, second } = copyNodes();
    expect(store.paste({ x: 0, y: -80 })).toBe(true);
    const pasted = [...selection.activeElementIds].map((id) => store.nodes[id]!);
    expect(pasted.map((node) => [node.transform.x, node.transform.y])).toEqual([
      [0, -30],
      [150, -80],
    ]);
    expect(store.nodes[first.id]!.transform).toEqual(first.transform);
    expect(store.nodes[second.id]!.transform).toEqual(second.transform);
    expect(loadClipboard()!.nodes.map((node) => [node.transform.x, node.transform.y])).toEqual([
      [100, 200],
      [250, 150],
    ]);

    const history = useHistoryStore();
    expect(history.undo()).toBe(true);
    expect(store.nodeOrder).toHaveLength(2);
    expect(history.redo()).toBe(true);
    expect(store.nodeOrder).toHaveLength(4);
  });

  it('keeps keyboard offsets independent of repeated targeted pastes', () => {
    const { store, selection } = copyNodes();
    const firstPosition = () => store.nodes[[...selection.activeElementIds][0]!]!.transform;
    store.paste();
    expect(firstPosition()).toMatchObject({ x: 120, y: 220 });
    store.paste({ x: 500, y: 600 });
    expect(firstPosition()).toMatchObject({ x: 500, y: 650 });
    store.paste({ x: 500, y: 600 });
    expect(firstPosition()).toMatchObject({ x: 500, y: 650 });
    store.paste();
    expect(firstPosition()).toMatchObject({ x: 140, y: 240 });
  });

  it.each([
    { rotation: 90, x: 250, y: 450 },
    { rotation: -90, x: 250, y: 450 },
    { rotation: 180, x: 300, y: 400 },
    { rotation: 45, x: 200 + 75 * Math.SQRT2, y: 350 + 75 * Math.SQRT2 },
  ])(
    'anchors a rectangle rotated $rotation degrees by its visible bounds',
    ({ rotation, x, y }) => {
      const store = useCanvasStore();
      const selection = useSelectionStore();
      const source = NodeFactory.createRect(100, 200);
      Object.assign(source.transform, { width: 200, height: 100, rotation });
      store.addNode(source);
      selection.setActive([source.id]);
      store.copySelected();

      expect(store.paste({ x: 300, y: 400 })).toBe(true);
      const pasted = store.nodes[[...selection.activeElementIds][0]!]!;
      expect(pasted.transform.x).toBeCloseTo(x);
      expect(pasted.transform.y).toBeCloseTo(y);
      expect(pasted.transform).toMatchObject({ width: 200, height: 100, rotation });
      expect(store.nodes[source.id]!.transform).toEqual(source.transform);
      expect(loadClipboard()!.nodes[0]!.transform).toEqual(source.transform);
    }
  );

  it('anchors a mixed selection by its combined rotated bounds', () => {
    const store = useCanvasStore();
    const selection = useSelectionStore();
    const rotated = NodeFactory.createRect(100, 200);
    Object.assign(rotated.transform, { width: 200, height: 100, rotation: 90 });
    const unrotated = NodeFactory.createRect(20, 300);
    store.addNode(rotated);
    store.addNode(unrotated);
    selection.setActive([rotated.id, unrotated.id]);
    store.copySelected();

    store.paste({ x: 500, y: 600 });
    const pasted = [...selection.activeElementIds].map((id) => store.nodes[id]!);
    expect(pasted[0]!.transform.x).toBeCloseTo(580);
    expect(pasted[0]!.transform.y).toBeCloseTo(650);
    expect(pasted[1]!.transform.x).toBeCloseTo(500);
    expect(pasted[1]!.transform.y).toBeCloseTo(750);
    expect(pasted[0]!.transform.rotation).toBe(90);
  });

  it('pastes a cut node at the target only once', () => {
    const { store, selection, first } = copyNodes();
    selection.setActive([first.id]);
    store.cutSelected();
    expect(store.paste({ x: 300, y: 400 })).toBe(true);
    const pasted = store.nodes[[...selection.activeElementIds][0]!]!;
    expect(pasted.transform).toMatchObject({ x: 300, y: 400 });
    expect(store.paste({ x: 500, y: 600 })).toBe(false);
  });
});
