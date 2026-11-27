import { ref, watch, type Ref } from 'vue';
import {
  applyTemplate,
  ensureFontsLoaded,
  getMeasurementContext,
  isTextObject,
  walkObjects,
  type LabelDocument,
  layoutText,
  paintText,
  type LabelObject,
  type TextLayout,
  type TextLayoutInput,
  type TextObject,
} from '@burnmark-io/designer-core';

/** Editor glue for designer-core's text layout: the editor paints exactly what print lays out. */

type CanvasContextLike = Parameters<typeof layoutText>[0];

/** Live, uncommitted values during an interactive resize. */
export type TextLiveOverrides = Partial<Pick<TextObject, 'width' | 'fontSize' | 'letterSpacing'>>;

/** Lay out a text object as the editor shows it (template variables resolved). */
export function layoutEditorText(
  object: TextLayoutInput,
  variables: Record<string, string>,
  overrides: TextLiveOverrides | null = null,
  ctx: CanvasContextLike = getMeasurementContext(),
): TextLayout {
  return layoutText(ctx, {
    ...object,
    ...overrides,
    content: applyTemplate(object.content, variables),
  });
}

const KEY_FIELDS = [
  'content',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'verticalAlign',
  'letterSpacing',
  'lineHeight',
  'width',
  'height',
  'wrap',
  'autoHeight',
] as const satisfies readonly (keyof TextLayoutInput)[];

/** A string identifying everything about `object` that affects layout. */
export function textLayoutKey(object: TextLayoutInput): string {
  return JSON.stringify(KEY_FIELDS.map(k => object[k]));
}

/** Inverse of {@link textLayoutKey}. */
export function parseTextLayoutKey(key: string): TextLayoutInput {
  const values = JSON.parse(key) as unknown[];
  return Object.fromEntries(KEY_FIELDS.map((k, i) => [k, values[i]])) as TextLayoutInput;
}

/** Konva placement: nodes rotate about the box centre (autoHeight box from the layout). */
export function textNodeTransform(
  object: Pick<TextObject, 'x' | 'y' | 'width' | 'rotation'>,
  layout: Pick<TextLayout, 'boxHeight'>,
): { x: number; y: number; offsetX: number; offsetY: number; rotation: number } {
  return {
    x: object.x + object.width / 2,
    y: object.y + layout.boxHeight / 2,
    offsetX: object.width / 2,
    offsetY: layout.boxHeight / 2,
    rotation: object.rotation,
  };
}

/** Paint a laid-out text object onto a native 2D context (object-local). */
export function paintEditorText(
  ctx: CanvasContextLike,
  object: Pick<TextObject, 'color' | 'invert'>,
  layout: TextLayout,
): void {
  paintText(ctx, { color: object.color, invert: object.invert, visible: true }, layout);
}

const fontEpoch = ref(0);
let fontListenerInstalled = false;

/** Bumped when fonts finish loading, so layouts re-measure with real metrics. */
export function useFontEpoch(): Readonly<Ref<number>> {
  if (!fontListenerInstalled && typeof document !== 'undefined' && 'fonts' in document) {
    fontListenerInstalled = true;
    const bump = (): void => {
      fontEpoch.value++;
    };
    document.fonts.addEventListener('loadingdone', bump);
    void document.fonts.ready.then(bump);
  }
  return fontEpoch;
}

/** Load the document's fonts through print's loader so the editor measures the real faces. */
export function useDocumentFonts(doc: () => LabelDocument): void {
  const epoch = useFontEpoch() as Ref<number>;
  watch(
    () => {
      const families = new Set<string>();
      for (const o of walkObjects(doc().objects)) if (isTextObject(o)) families.add(o.fontFamily);
      return [...families].sort().join('\n');
    },
    () => {
      void ensureFontsLoaded(doc()).then(() => {
        epoch.value++;
      });
    },
    { immediate: true },
  );
}

const LAYOUT_FIELDS: readonly (keyof TextObject)[] = [
  'content',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'width',
  'wrap',
  'autoHeight',
];

/** For autoHeight text, add the re-measured `height` to a patch that changes layout. */
export function withAutoHeight(
  existing: LabelObject | undefined,
  patch: Partial<LabelObject>,
  variables: Record<string, string>,
): Partial<LabelObject> {
  if (existing?.type !== 'text') return patch;
  const next = { ...existing, ...patch } as TextObject;
  if (!next.autoHeight) return patch;
  if (!LAYOUT_FIELDS.some(k => k in patch)) return patch;
  try {
    const height = layoutEditorText(next, variables).contentHeight;
    return Math.abs(height - existing.height) < 1e-6 && !('height' in patch)
      ? patch
      : { ...patch, height };
  } catch {
    // No measurement context (non-browser test environment).
    return patch;
  }
}

/** {@link withAutoHeight} for an object input that isn't in the document yet. */
export function withAutoHeightInput<T extends { type: string }>(
  input: T,
  variables: Record<string, string>,
): T {
  if (input.type !== 'text') return input;
  const text = input as unknown as TextObject;
  if (!text.autoHeight) return input;
  try {
    return { ...input, height: layoutEditorText(text, variables).contentHeight };
  } catch {
    return input;
  }
}
