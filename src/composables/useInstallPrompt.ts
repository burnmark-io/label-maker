import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import type { ComputedRef } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SESSIONS_BEFORE_PROMPT = 2;

const deferredEvent = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);

export function useInstallPrompt(): {
  visible: ComputedRef<boolean>;
  install: () => Promise<void>;
  dismiss: () => void;
} {
  const prefs = usePreferencesStore();

  const visible = computed<boolean>(() => {
    if (installed.value) return false;
    if (!deferredEvent.value) return false;
    if (prefs.sessionCount < MIN_SESSIONS_BEFORE_PROMPT) return false;
    if (prefs.installPromptDismissedAt > 0) {
      const elapsed = Date.now() - prefs.installPromptDismissedAt;
      if (elapsed < SEVEN_DAYS_MS) return false;
    }
    return true;
  });

  function onBeforeInstallPrompt(e: Event): void {
    e.preventDefault();
    deferredEvent.value = e as BeforeInstallPromptEvent;
  }

  function onAppInstalled(): void {
    installed.value = true;
    deferredEvent.value = null;
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  async function install(): Promise<void> {
    const ev = deferredEvent.value;
    if (!ev) return;
    deferredEvent.value = null;
    await ev.prompt();
    await ev.userChoice;
  }

  function dismiss(): void {
    prefs.installPromptDismissedAt = Date.now();
    deferredEvent.value = null;
  }

  return { visible, install, dismiss };
}
