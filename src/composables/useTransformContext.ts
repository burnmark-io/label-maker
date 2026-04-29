import { ref, type Ref } from 'vue';

const activeAnchor = ref<string>('');

/** Per-object snapshot captured at transformstart for group-relative math. */
export interface PerObjectSnapshot {
  /** Offset from group centre in canvas-dot coordinates, pre-transform. */
  offsetX: number;
  offsetY: number;
  /** Pre-transform size in dots. */
  width: number;
  height: number;
  /** Pre-transform rotation in degrees. */
  rotation: number;
}

/** Group-bounds context captured by SelectionTransformer on transformstart. */
export interface GroupTransformContext {
  /** Centre of the axis-aligned bounding box of all selected objects. */
  centre: { x: number; y: number };
  /** Per-object snapshots keyed by object id. */
  perObject: Map<string, PerObjectSnapshot>;
}

const groupContext = ref<GroupTransformContext | null>(null);

/**
 * Shared state for in-flight Konva Transformer drags. The
 * SelectionTransformer writes the active anchor name and group context
 * on transformstart; node components (TextNode, etc.) read them during
 * their own transform handlers to decide what the user is asking for.
 */
export function useTransformContext(): {
  activeAnchor: Ref<string>;
  groupContext: Ref<GroupTransformContext | null>;
} {
  return { activeAnchor, groupContext };
}
