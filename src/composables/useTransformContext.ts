import { ref, type Ref } from 'vue';

const activeAnchor = ref<string>('');

/**
 * Shared state for in-flight Konva Transformer drags. The
 * SelectionTransformer writes the active anchor name on transformstart;
 * node components (TextNode, etc.) read it during their own transform
 * handlers to decide what the user is asking for.
 */
export function useTransformContext(): { activeAnchor: Ref<string> } {
  return { activeAnchor };
}
