import { ref } from 'vue';

const aboutOpen = ref(false);
const helpOpen = ref(false);
const tourActive = ref(false);

/**
 * App-wide handles for the help/about/tour overlays. AppShell renders the
 * components; any component can open them by toggling these flags.
 */
export function useUiDialogs(): {
  aboutOpen: typeof aboutOpen;
  helpOpen: typeof helpOpen;
  tourActive: typeof tourActive;
  openAbout: () => void;
  openHelp: () => void;
  startTour: () => void;
  closeTour: () => void;
} {
  function openAbout(): void {
    aboutOpen.value = true;
  }
  function openHelp(): void {
    helpOpen.value = true;
  }
  function startTour(): void {
    tourActive.value = true;
  }
  function closeTour(): void {
    tourActive.value = false;
  }
  return { aboutOpen, helpOpen, tourActive, openAbout, openHelp, startTour, closeTour };
}
