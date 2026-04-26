<template>
  <Modal
    :open="open"
    size="md"
    :title="step === 'nudge' ? t('passkey.nudge.title') : t('encryption.setup.title')"
    :close-label="t('common.close')"
    @close="onClose"
  >
    <div v-if="step === 'form'" class="setup">
      <div class="setup__warning">
        <strong>⚠ {{ t('encryption.setup.warningRecoveryHeading') }}</strong>
        <p>{{ t('encryption.setup.warningRecovery') }}</p>
      </div>
      <div class="setup__warning">
        <strong>⚠ {{ t('encryption.setup.warningScopeHeading') }}</strong>
        <p>{{ t('encryption.setup.warningScope') }}</p>
      </div>

      <p class="setup__note">{{ t('encryption.setup.noteUnsaved') }}</p>

      <form class="setup__form" @submit.prevent="onSubmit">
        <label class="setup__label" for="setup-pw">
          {{ t('encryption.setup.passwordLabel') }}
        </label>
        <input
          id="setup-pw"
          v-model="password"
          type="password"
          class="setup__input"
          autocomplete="new-password"
          :disabled="busy"
        />
        <p class="setup__hint">{{ t('encryption.setup.lengthHint') }}</p>

        <label class="setup__label" for="setup-confirm">
          {{ t('encryption.setup.confirmLabel') }}
        </label>
        <input
          id="setup-confirm"
          v-model="confirm"
          type="password"
          class="setup__input"
          autocomplete="new-password"
          :disabled="busy"
        />

        <p v-if="errorKey" class="setup__error" role="alert">
          {{ t(errorKey) }}
        </p>

        <label class="setup__check">
          <input v-model="acknowledged" type="checkbox" :disabled="busy" />
          <span>{{ t('encryption.setup.acknowledge') }}</span>
        </label>
      </form>
    </div>

    <div v-else class="nudge">
      <div class="nudge__icon" aria-hidden="true">✨</div>
      <p class="nudge__body">{{ t('passkey.nudge.body') }}</p>
      <p v-if="nudgeError" class="nudge__error" role="alert">{{ t(nudgeError) }}</p>
    </div>

    <template #footer>
      <template v-if="step === 'form'">
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="onClose">
          {{ t('encryption.setup.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canSubmit || busy"
          @click="onSubmit"
        >
          {{ busy ? t('encryption.setup.encrypting') : t('encryption.setup.submit') }}
        </button>
      </template>
      <template v-else>
        <button type="button" class="btn btn--ghost" :disabled="nudgeBusy" @click="onSkipNudge">
          {{ t('passkey.nudge.maybeLater') }}
        </button>
        <button type="button" class="btn btn--primary" :disabled="nudgeBusy" @click="onAcceptNudge">
          {{ nudgeBusy ? t('passkey.nudge.adding') : addPasskeyLabel }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';
import { useCryptoStore } from '@/stores/crypto';
import {
  detectPasskeyPlatform,
  isPrfLikelySupported,
  isWebAuthnAvailable,
} from '@/services/webauthn';

const MIN_PASSWORD_LENGTH = 8;

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>();
const { t } = useI18n();
const crypto = useCryptoStore();

const password = ref('');
const confirm = ref('');
const acknowledged = ref(false);
const busy = ref(false);
const errorKey = ref<string | null>(null);

const step = ref<'form' | 'nudge'>('form');
const nudgeBusy = ref(false);
const nudgeError = ref<string | null>(null);

const canSubmit = computed(
  () =>
    password.value.length >= MIN_PASSWORD_LENGTH &&
    password.value === confirm.value &&
    acknowledged.value,
);

const addPasskeyLabel = computed(() => {
  const platform = detectPasskeyPlatform();
  if (platform === 'touchid') return t('passkey.add.touchid');
  if (platform === 'windows-hello') return t('passkey.add.windowsHello');
  return t('passkey.add.generic');
});

watch(
  () => props.open,
  isOpen => {
    if (!isOpen) {
      // Reset all transient state every time the dialog closes — including
      // after a successful flow — so the next open starts clean.
      password.value = '';
      confirm.value = '';
      acknowledged.value = false;
      errorKey.value = null;
      busy.value = false;
      step.value = 'form';
      nudgeBusy.value = false;
      nudgeError.value = null;
    }
  },
);

function onClose(): void {
  if (busy.value || nudgeBusy.value) return;
  emit('close');
}

async function onSubmit(): Promise<void> {
  if (busy.value) return;
  errorKey.value = null;
  if (password.value.length < MIN_PASSWORD_LENGTH) {
    errorKey.value = 'encryption.setup.errorTooShort';
    return;
  }
  if (password.value !== confirm.value) {
    errorKey.value = 'encryption.setup.errorMismatch';
    return;
  }
  busy.value = true;
  try {
    await crypto.setupEncryption(password.value);
    emit('done');
    // Drop the password from local refs ASAP — we still need to decide
    // whether to show the nudge or close, but we don't need the string.
    password.value = '';
    confirm.value = '';

    if (isWebAuthnAvailable() && (await isPrfLikelySupported())) {
      step.value = 'nudge';
    } else {
      emit('close');
    }
  } catch (err) {
    errorKey.value = 'encryption.setup.errorGeneric';
    console.error('[burnmark] setupEncryption failed:', err);
  } finally {
    busy.value = false;
  }
}

function onSkipNudge(): void {
  if (nudgeBusy.value) return;
  emit('close');
}

async function onAcceptNudge(): Promise<void> {
  if (nudgeBusy.value) return;
  nudgeError.value = null;
  nudgeBusy.value = true;
  try {
    const result = await crypto.addPasskey();
    if (!result.ok) {
      // Map known reason codes to friendly i18n strings; fall through to
      // a generic message for anything else.
      if (result.reason === 'register-cancelled' || result.reason === 'auth-cancelled') {
        nudgeError.value = 'passkey.errors.cancelled';
      } else if (result.reason === 'prf-not-supported' || result.reason === 'prf-eval-failed') {
        nudgeError.value = 'passkey.errors.prfNotSupported';
      } else {
        nudgeError.value = 'passkey.errors.failed';
      }
      return;
    }
    emit('close');
  } finally {
    nudgeBusy.value = false;
  }
}
</script>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.setup__warning {
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-canvas);
  border-left: 3px solid #d4a017;
  border-radius: var(--radius-sm);
}

.setup__warning strong {
  display: block;
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-1);
}

.setup__warning p {
  margin: 0;
  color: var(--color-text-secondary);
}

.setup__note {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-panel);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.setup__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setup__label {
  font-weight: var(--weight-medium);
}

.setup__input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  font-size: var(--text-base);
  color: var(--color-text);
}

.setup__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.setup__error {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-danger, #c0392b);
}

.setup__check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.nudge {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-3);
}

.nudge__icon {
  font-size: 32px;
}

.nudge__body {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text);
  max-width: 36ch;
}

.nudge__error {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger, #c0392b);
}

.btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: var(--weight-medium);
  border: 1px solid transparent;
  cursor: pointer;
}

.btn--ghost {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-canvas);
}

.btn--primary {
  background: var(--color-primary);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
