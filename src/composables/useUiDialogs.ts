import { ref } from 'vue';

const aboutOpen = ref(false);
const helpOpen = ref(false);
const privacyOpen = ref(false);
const tourActive = ref(false);

/**
 * App-wide handles for the help/about/privacy/tour overlays. AppShell renders
 * the components; any component can open them by toggling these flags.
 */
export function useUiDialogs(): {
  aboutOpen: typeof aboutOpen;
  helpOpen: typeof helpOpen;
  privacyOpen: typeof privacyOpen;
  tourActive: typeof tourActive;
  openAbout: () => void;
  openHelp: () => void;
  openPrivacy: () => void;
  startTour: () => void;
  closeTour: () => void;
} {
  function openAbout(): void {
    aboutOpen.value = true;
  }
  function openHelp(): void {
    helpOpen.value = true;
  }
  function openPrivacy(): void {
    privacyOpen.value = true;
  }
  function startTour(): void {
    tourActive.value = true;
  }
  function closeTour(): void {
    tourActive.value = false;
  }
  return {
    aboutOpen,
    helpOpen,
    privacyOpen,
    tourActive,
    openAbout,
    openHelp,
    openPrivacy,
    startTour,
    closeTour,
  };
}
