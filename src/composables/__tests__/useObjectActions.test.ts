import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useObjectActions } from '../useObjectActions';
import { useDesignerStore, DOCUMENT_SELECTION_ID } from '@/stores/designer';

function makeText(): Parameters<ReturnType<typeof useDesignerStore>['addObject']>[0] {
  return {
    type: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    content: 'Hello',
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#000',
    letterSpacing: 0,
    lineHeight: 1.2,
    invert: false,
    wrap: false,
    autoHeight: false,
  } as Parameters<ReturnType<typeof useDesignerStore>['addObject']>[0];
}

describe('useObjectActions.deleteSelection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('removes every object in the selection and clears it', () => {
    const designer = useDesignerStore();
    const ids = [designer.addObject(makeText()), designer.addObject(makeText())];
    designer.select(ids);

    const { deleteSelection } = useObjectActions();
    deleteSelection();

    expect(designer.document.objects).toHaveLength(0);
    expect(designer.selection).toEqual([]);
  });

  it('removes locked objects too (lock affects geometry, not deletion)', () => {
    const designer = useDesignerStore();
    const id = designer.addObject(makeText());
    designer.updateObject(id, { locked: true });
    designer.select([id]);

    useObjectActions().deleteSelection();

    expect(designer.document.objects).toHaveLength(0);
  });

  it('is a no-op when selection is empty', () => {
    const designer = useDesignerStore();
    designer.addObject(makeText());

    useObjectActions().deleteSelection();

    expect(designer.document.objects).toHaveLength(1);
  });

  it('does not remove anything when only the document sentinel is selected', () => {
    const designer = useDesignerStore();
    const id = designer.addObject(makeText());
    designer.select([DOCUMENT_SELECTION_ID]);

    useObjectActions().deleteSelection();

    expect(designer.document.objects.map(o => o.id)).toEqual([id]);
  });
});
