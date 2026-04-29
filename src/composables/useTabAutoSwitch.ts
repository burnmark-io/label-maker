import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useDesignerStore } from '@/stores/designer';
import { usePreferencesStore } from '@/stores/preferences';
import { useBuildingModifier } from './useBuildingModifier';

/**
 * Symmetric auto-switch between Object and Properties tabs:
 *   - 0  → 1+  selected, currently on 'objects'    → switch to 'properties'
 *   - 1+ → 0   selected, currently on 'properties' → switch to 'objects'
 *
 * Manual choice (Data, Preview) is respected — neither rule fires there.
 * The Properties tab badge still reflects selection count regardless.
 *
 * Modifier-defer: while a building modifier (Shift / Cmd / Ctrl) is held,
 * auto-switch is suppressed so multi-select gestures (Shift-click chains)
 * aren't interrupted between additions. On modifier release the rule
 * re-evaluates against the *current* tab — if the user manually switched
 * to Data mid-gesture, leave them alone.
 */
export function useTabAutoSwitch(): void {
  const designer = useDesignerStore();
  const prefs = usePreferencesStore();
  const buildingHeld = useBuildingModifier();
  const { selection } = storeToRefs(designer);

  function maybeSwitch(currentlyEmpty: boolean, previouslyEmpty: boolean): void {
    if (buildingHeld.value) return;
    if (previouslyEmpty && !currentlyEmpty && prefs.sidePanelTab === 'objects') {
      prefs.sidePanelTab = 'properties';
    } else if (!previouslyEmpty && currentlyEmpty && prefs.sidePanelTab === 'properties') {
      prefs.sidePanelTab = 'objects';
    }
  }

  watch(
    () => selection.value.length,
    (next, prev) => {
      maybeSwitch(next === 0, prev === 0);
    },
  );

  // Re-evaluate on modifier release — gestures like a Shift-click chain
  // suppress the watcher above; release is the moment we decide.
  watch(buildingHeld, (held, wasHeld) => {
    if (wasHeld && !held) {
      const empty = selection.value.length === 0;
      // Treat the post-release state as the "from empty" transition only if
      // the gesture started from an empty selection. Without that we'd
      // re-fire on every release. We approximate by always evaluating against
      // the current tab + current selection: if the user is on Object and
      // now has a non-empty selection, switch — they finished building.
      if (!empty && prefs.sidePanelTab === 'objects') {
        prefs.sidePanelTab = 'properties';
      } else if (empty && prefs.sidePanelTab === 'properties') {
        prefs.sidePanelTab = 'objects';
      }
    }
  });
}
