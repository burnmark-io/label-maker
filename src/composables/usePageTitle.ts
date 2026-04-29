import { watch } from 'vue';
import { useDesignerStore } from '@/stores/designer';

const DEFAULT_NAME = 'Untitled label';
const FALLBACK_TITLE = 'burnmark';

export function usePageTitle(): void {
  const designer = useDesignerStore();
  watch(
    () => designer.document.name,
    name => {
      const trimmed = name?.trim();
      document.title =
        trimmed && trimmed !== DEFAULT_NAME ? `${trimmed} — ${FALLBACK_TITLE}` : FALLBACK_TITLE;
    },
    { immediate: true },
  );
}
