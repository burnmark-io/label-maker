import { onMounted, onBeforeUnmount } from 'vue';
import type { LabelObject, LabelObjectInput } from '@burnmark-io/designer-core';
import { useDesignerStore } from '@/stores/designer';

/**
 * Global keyboard shortcuts for the editor. Mounted once at the app shell
 * level. Keys typed inside form fields are ignored unless they're for
 * shortcuts that explicitly belong to those fields.
 */
export function useKeyboardShortcuts(): void {
  const designer = useDesignerStore();
  const clipboard: { items: LabelObjectInput[] } = { items: [] };

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return false;
  }

  function selectedObjects(): LabelObject[] {
    const ids = designer.selection;
    return designer.document.objects.filter((o) => ids.includes(o.id));
  }

  function copySelection(): void {
    const items = selectedObjects().map((o) => {
      const { id: _id, ...rest } = o;
      void _id;
      return rest as LabelObjectInput;
    });
    if (items.length > 0) clipboard.items = items;
  }

  function pasteAtOffset(offsetX = 12, offsetY = 12): void {
    if (clipboard.items.length === 0) return;
    const newIds: string[] = [];
    for (const item of clipboard.items) {
      const copy = { ...item, x: item.x + offsetX, y: item.y + offsetY } as LabelObjectInput;
      newIds.push(designer.addObject(copy));
    }
    designer.select(newIds);
  }

  function nudgeSelection(dx: number, dy: number): void {
    for (const o of selectedObjects()) {
      designer.updateObject(o.id, { x: o.x + dx, y: o.y + dy });
    }
  }

  function deleteSelection(): void {
    for (const id of [...designer.selection]) designer.removeObject(id);
    designer.deselect();
  }

  function selectAll(): void {
    designer.select(designer.document.objects.filter((o) => o.visible).map((o) => o.id));
  }

  function reorderSelection(direction: 'up' | 'down' | 'top' | 'bottom'): void {
    for (const id of designer.selection) designer.reorder(id, direction);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const cmd = event.ctrlKey || event.metaKey;
    const editable = isEditableTarget(event.target);

    // Allow Cmd/Ctrl+Z and Cmd/Ctrl+Y inside editable fields too — feels more natural.
    if (cmd && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      designer.undo();
      return;
    }
    if (cmd && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
      event.preventDefault();
      designer.redo();
      return;
    }

    if (editable) return;

    if (cmd && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
    if (cmd && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelection();
      return;
    }
    if (cmd && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      pasteAtOffset();
      return;
    }
    if (cmd && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      copySelection();
      pasteAtOffset();
      return;
    }
    if (cmd && event.key === ']') {
      event.preventDefault();
      reorderSelection(event.shiftKey ? 'top' : 'up');
      return;
    }
    if (cmd && event.key === '[') {
      event.preventDefault();
      reorderSelection(event.shiftKey ? 'bottom' : 'down');
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (designer.selection.length > 0) {
        event.preventDefault();
        deleteSelection();
      }
      return;
    }

    if (event.key === 'Escape') {
      designer.deselect();
      return;
    }

    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudgeSelection(0, -step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudgeSelection(0, step);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nudgeSelection(-step, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nudgeSelection(step, 0);
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
  });
}
