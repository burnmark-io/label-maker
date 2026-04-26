<template>
  <Modal
    :open="open"
    size="md"
    :title="t('privacy.title')"
    :close-label="t('common.close')"
    @close="onClose"
  >
    <div class="privacy">
      <section class="privacy__section">
        <h3 class="privacy__heading">{{ t('privacy.howStored.heading') }}</h3>
        <p>{{ t('privacy.howStored.body1') }}</p>
        <p>
          {{ t('privacy.howStored.body2') }}
          <a :href="clearSiteDataUrl" target="_blank" rel="noopener noreferrer">{{
            t('privacy.howStored.clearLink')
          }}</a>
        </p>
      </section>

      <section class="privacy__section">
        <h3 class="privacy__heading">{{ t('privacy.yourData.heading') }}</h3>
        <ul class="privacy__counters">
          <li>{{ t('privacy.yourData.designs', { n: designsCount, max: designsMax }) }}</li>
          <li>{{ t('privacy.yourData.datasets', { n: datasetsCount, max: datasetsMax }) }}</li>
          <li>{{ t('privacy.yourData.assets', { n: assetsCount }) }}</li>
          <li v-if="storageMb !== null">
            {{ t('privacy.yourData.storage', { mb: storageMb }) }}
          </li>
        </ul>
      </section>

      <section class="privacy__section">
        <h3 class="privacy__heading">{{ t('privacy.encryption.heading') }}</h3>

        <template v-if="!crypto.enabled">
          <p>{{ t('privacy.encryption.offDescription') }}</p>
          <details class="privacy__details">
            <summary>{{ t('privacy.encryption.whyHeading') }}</summary>
            <p>{{ t('privacy.encryption.whyBody') }}</p>
          </details>
          <button class="btn btn--primary" type="button" @click="setupOpen = true">
            {{ t('privacy.encryption.setupCta') }}
          </button>
        </template>

        <template v-else>
          <p class="privacy__statusOn">{{ t('privacy.encryption.onDescription') }}</p>

          <div class="privacy__actions">
            <button
              type="button"
              class="btn btn--ghost"
              :disabled="actionsBusy"
              @click="toggleChange"
            >
              {{ t('privacy.encryption.changeCta') }}
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              :disabled="actionsBusy"
              @click="toggleDisable"
            >
              {{ t('privacy.encryption.disableCta') }}
            </button>
          </div>

          <form v-if="showChange" class="privacy__form" @submit.prevent="onChangePassword">
            <h4 class="privacy__formTitle">{{ t('encryption.change.title') }}</h4>
            <label class="privacy__label" for="cp-old">{{ t('encryption.change.oldLabel') }}</label>
            <input
              id="cp-old"
              v-model="oldPw"
              type="password"
              class="privacy__input"
              autocomplete="current-password"
              :disabled="actionsBusy"
            />
            <label class="privacy__label" for="cp-new">{{ t('encryption.change.newLabel') }}</label>
            <input
              id="cp-new"
              v-model="newPw"
              type="password"
              class="privacy__input"
              autocomplete="new-password"
              :disabled="actionsBusy"
            />
            <label class="privacy__label" for="cp-confirm">
              {{ t('encryption.change.confirmLabel') }}
            </label>
            <input
              id="cp-confirm"
              v-model="newPwConfirm"
              type="password"
              class="privacy__input"
              autocomplete="new-password"
              :disabled="actionsBusy"
            />
            <p v-if="changeError" class="privacy__error" role="alert">{{ t(changeError) }}</p>
            <div class="privacy__formActions">
              <button
                type="button"
                class="btn btn--ghost"
                :disabled="actionsBusy"
                @click="resetChangeForm"
              >
                {{ t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn--primary" :disabled="!canChange || actionsBusy">
                {{ actionsBusy ? t('encryption.change.busy') : t('encryption.change.submit') }}
              </button>
            </div>
          </form>

          <form v-if="showDisable" class="privacy__form" @submit.prevent="onDisableEncryption">
            <h4 class="privacy__formTitle">{{ t('encryption.disable.title') }}</h4>
            <p class="privacy__formBody">{{ t('encryption.disable.body') }}</p>
            <p v-if="crypto.hasPasskey" class="privacy__formBody">
              {{ t('passkey.privacy.disableNote') }}
            </p>
            <label class="privacy__label" for="di-pw">{{
              t('encryption.disable.passwordLabel')
            }}</label>
            <input
              id="di-pw"
              v-model="disablePw"
              type="password"
              class="privacy__input"
              autocomplete="current-password"
              :disabled="actionsBusy"
            />
            <p v-if="disableError" class="privacy__error" role="alert">{{ t(disableError) }}</p>
            <div class="privacy__formActions">
              <button
                type="button"
                class="btn btn--ghost"
                :disabled="actionsBusy"
                @click="resetDisableForm"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                class="btn btn--danger"
                :disabled="disablePw.length === 0 || actionsBusy"
              >
                {{ actionsBusy ? t('encryption.disable.busy') : t('encryption.disable.submit') }}
              </button>
            </div>
          </form>

          <div class="privacy__devices">
            <h4 class="privacy__formTitle">{{ t('passkey.privacy.heading') }}</h4>
            <ul class="privacy__deviceList">
              <li class="privacy__device">
                <span class="privacy__deviceIcon" aria-hidden="true">🔑</span>
                <span class="privacy__deviceLabel">{{ t('passkey.privacy.passwordRow') }}</span>
              </li>
              <li v-if="crypto.hasPasskey" class="privacy__device">
                <span class="privacy__deviceIcon" aria-hidden="true">👆</span>
                <span class="privacy__deviceLabel">
                  {{ t('passkey.privacy.passkeyRow', { date: passkeyAddedDate ?? '' }) }}
                </span>
                <button
                  type="button"
                  class="btn btn--ghost privacy__deviceRemove"
                  :disabled="passkeyBusy"
                  @click="onRemovePasskey"
                >
                  {{ passkeyBusy ? t('common.loading') : t('passkey.privacy.remove') }}
                </button>
              </li>
            </ul>

            <button
              v-if="canAddPasskey"
              type="button"
              class="btn btn--primary privacy__deviceAdd"
              :disabled="passkeyBusy"
              @click="onAddPasskey"
            >
              {{ passkeyBusy ? t('passkey.nudge.adding') : addPasskeyLabel }}
            </button>
            <p v-else-if="!webauthnSupported" class="privacy__deviceNote">
              {{ t('passkey.privacy.unsupportedNote') }}
            </p>
            <p v-if="passkeyError" class="privacy__error" role="alert">
              {{ t(passkeyError) }}
            </p>
            <p v-if="crypto.hasPasskey || canAddPasskey" class="privacy__deviceNote">
              {{ t('passkey.privacy.synced') }}
            </p>
          </div>
        </template>
      </section>

      <section class="privacy__section privacy__section--reset">
        <h3 class="privacy__heading">{{ t('privacy.reset.heading') }}</h3>
        <p>{{ t('privacy.reset.body') }}</p>
        <button class="btn btn--danger" type="button" @click="emit('open-reset')">
          {{ t('privacy.reset.cta') }}
        </button>
      </section>
    </div>

    <EncryptionSetup :open="setupOpen" @close="setupOpen = false" @done="setupOpen = false" />
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';
import EncryptionSetup from './EncryptionSetup.vue';
import { useCryptoStore } from '@/stores/crypto';
import { useLibraryStore } from '@/stores/library';
import { useDataStore } from '@/stores/data';
import { countAssets } from '@/services/storage';
import { MAX_SLOTS } from '@/stores/library';
import { DATASET_LIMIT } from '@/stores/data';
import {
  detectPasskeyPlatform,
  isPrfLikelySupported,
  isWebAuthnAvailable,
} from '@/services/webauthn';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-reset'): void }>();
const { t } = useI18n();

const crypto = useCryptoStore();
const library = useLibraryStore();
const dataStore = useDataStore();

const clearSiteDataUrl =
  'https://developer.mozilla.org/en-US/docs/Web/Privacy/Storage_Access_Policy';

// Counters
const assetsCount = ref(0);
const storageMb = ref<number | null>(null);

const designsCount = computed(() => library.entries.length);
const designsMax = MAX_SLOTS;
const datasetsCount = computed(() => dataStore.datasets.length);
const datasetsMax = DATASET_LIMIT;

// Forms
const setupOpen = ref(false);
const showChange = ref(false);
const showDisable = ref(false);
const oldPw = ref('');
const newPw = ref('');
const newPwConfirm = ref('');
const disablePw = ref('');
const changeError = ref<string | null>(null);
const disableError = ref<string | null>(null);
const actionsBusy = ref(false);

// Passkey UI state
const webauthnSupported = ref(isWebAuthnAvailable());
const prfSupported = ref(false);
const passkeyBusy = ref(false);
const passkeyError = ref<string | null>(null);

const passkeyAddedDate = computed(() => {
  if (!crypto.passkeyAddedAt) return null;
  const d = new Date(crypto.passkeyAddedAt);
  if (Number.isNaN(d.getTime())) return crypto.passkeyAddedAt;
  return d.toLocaleDateString();
});

const canAddPasskey = computed(
  () => webauthnSupported.value && prfSupported.value && !crypto.hasPasskey,
);

const addPasskeyLabel = computed(() => {
  const platform = detectPasskeyPlatform();
  if (platform === 'touchid') return t('passkey.add.touchid');
  if (platform === 'windows-hello') return t('passkey.add.windowsHello');
  return t('passkey.add.generic');
});

const canChange = computed(
  () => oldPw.value.length > 0 && newPw.value.length >= 8 && newPw.value === newPwConfirm.value,
);

watch(
  () => props.open,
  isOpen => {
    if (isOpen) {
      void refreshCounters();
      void refreshPrfCapability();
      // Reset transient form state every open.
      setupOpen.value = false;
      resetChangeForm();
      resetDisableForm();
      passkeyError.value = null;
    }
  },
);

async function refreshPrfCapability(): Promise<void> {
  if (!webauthnSupported.value) {
    prfSupported.value = false;
    return;
  }
  try {
    prfSupported.value = await isPrfLikelySupported();
  } catch {
    prfSupported.value = false;
  }
}

async function refreshCounters(): Promise<void> {
  // Asset count is async — the other counters are reactive refs.
  if (crypto.locked) {
    assetsCount.value = 0;
    storageMb.value = null;
    return;
  }
  try {
    assetsCount.value = await countAssets();
  } catch {
    assetsCount.value = 0;
  }
  if (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    'estimate' in navigator.storage
  ) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') {
        storageMb.value = Math.max(0, Math.round(est.usage / 1024 / 1024));
      } else {
        storageMb.value = null;
      }
    } catch {
      storageMb.value = null;
    }
  } else {
    storageMb.value = null;
  }
}

function onClose(): void {
  if (actionsBusy.value) return;
  emit('close');
}

function toggleChange(): void {
  showDisable.value = false;
  showChange.value = !showChange.value;
  if (!showChange.value) resetChangeForm();
}

function toggleDisable(): void {
  showChange.value = false;
  showDisable.value = !showDisable.value;
  if (!showDisable.value) resetDisableForm();
}

function resetChangeForm(): void {
  showChange.value = false;
  oldPw.value = '';
  newPw.value = '';
  newPwConfirm.value = '';
  changeError.value = null;
}

function resetDisableForm(): void {
  showDisable.value = false;
  disablePw.value = '';
  disableError.value = null;
}

async function onChangePassword(): Promise<void> {
  if (!canChange.value || actionsBusy.value) return;
  changeError.value = null;
  if (newPw.value !== newPwConfirm.value) {
    changeError.value = 'encryption.change.errorMismatch';
    return;
  }
  actionsBusy.value = true;
  try {
    const ok = await crypto.changePassword(oldPw.value, newPw.value);
    if (!ok) {
      changeError.value = 'encryption.change.errorWrongOld';
    } else {
      resetChangeForm();
    }
  } finally {
    actionsBusy.value = false;
  }
}

async function onDisableEncryption(): Promise<void> {
  if (disablePw.value.length === 0 || actionsBusy.value) return;
  disableError.value = null;
  actionsBusy.value = true;
  try {
    const ok = await crypto.disableEncryption(disablePw.value);
    if (!ok) {
      disableError.value = 'encryption.disable.errorWrong';
    } else {
      resetDisableForm();
    }
  } finally {
    actionsBusy.value = false;
  }
}

async function onAddPasskey(): Promise<void> {
  if (passkeyBusy.value) return;
  passkeyError.value = null;
  passkeyBusy.value = true;
  try {
    const result = await crypto.addPasskey();
    if (!result.ok) {
      if (result.reason === 'register-cancelled' || result.reason === 'auth-cancelled') {
        passkeyError.value = 'passkey.errors.cancelled';
      } else if (result.reason === 'prf-not-supported' || result.reason === 'prf-eval-failed') {
        passkeyError.value = 'passkey.errors.prfNotSupported';
      } else {
        passkeyError.value = 'passkey.errors.failed';
      }
    }
  } finally {
    passkeyBusy.value = false;
  }
}

async function onRemovePasskey(): Promise<void> {
  if (passkeyBusy.value) return;
  if (typeof window !== 'undefined') {
    if (!window.confirm(t('passkey.privacy.confirmRemove'))) return;
  }
  passkeyError.value = null;
  passkeyBusy.value = true;
  try {
    await crypto.removePasskey();
  } finally {
    passkeyBusy.value = false;
  }
}
</script>

<style scoped>
.privacy {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.privacy__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.privacy__section--reset {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}

.privacy__heading {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.privacy__counters {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--color-text-secondary);
}

.privacy__details {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.privacy__details summary {
  cursor: pointer;
  color: var(--color-primary-text);
}

.privacy__details p {
  margin: var(--space-1) 0 0;
}

.privacy__statusOn {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-canvas);
  border-radius: var(--radius-sm);
}

.privacy__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.privacy__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-canvas);
  border-radius: var(--radius-md);
}

.privacy__formTitle {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.privacy__formBody {
  margin: 0;
  color: var(--color-text-secondary);
}

.privacy__label {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.privacy__input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.privacy__error {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger, #c0392b);
}

.privacy__formActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: var(--weight-medium);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: var(--text-sm);
}

.btn--primary {
  background: var(--color-primary);
  color: white;
  align-self: flex-start;
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn--ghost {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-canvas);
}

.btn--danger {
  background: var(--color-danger, #c0392b);
  color: white;
  align-self: flex-start;
}

.btn--danger:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.privacy__devices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.privacy__deviceList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.privacy__device {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-canvas);
  border-radius: var(--radius-sm);
}

.privacy__deviceIcon {
  font-size: var(--text-base);
}

.privacy__deviceLabel {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.privacy__deviceRemove {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
}

.privacy__deviceAdd {
  align-self: flex-start;
  font-size: var(--text-sm);
}

.privacy__deviceNote {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
