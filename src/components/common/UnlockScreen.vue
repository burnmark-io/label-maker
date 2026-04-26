<template>
  <div class="unlock" role="dialog" :aria-label="t('encryption.unlock.title')">
    <div class="unlock__panel">
      <div class="unlock__brand">
        <span class="unlock__icon" aria-hidden="true">🏷️</span>
        <span class="unlock__appname">{{ t('app.name') }}</span>
      </div>
      <h1 class="unlock__title">{{ t('encryption.unlock.title') }}</h1>
      <p class="unlock__subtitle">{{ t('encryption.unlock.subtitle') }}</p>

      <form class="unlock__form" @submit.prevent="onSubmit">
        <label class="unlock__label" for="unlock-pw">{{
          t('encryption.unlock.passwordLabel')
        }}</label>
        <input
          id="unlock-pw"
          ref="inputRef"
          v-model="password"
          type="password"
          class="unlock__input"
          autocomplete="current-password"
          :disabled="busy"
          :aria-invalid="hasError"
          :aria-describedby="hasError ? 'unlock-error' : undefined"
        />
        <p v-if="hasError" id="unlock-error" class="unlock__error" role="alert">
          {{ t('encryption.unlock.error') }}
        </p>
        <button class="unlock__submit" type="submit" :disabled="busy || password.length === 0">
          {{ busy ? t('encryption.unlock.loading') : t('encryption.unlock.submit') }}
        </button>
      </form>

      <button type="button" class="unlock__forgot" :disabled="busy" @click="emit('open-reset')">
        {{ t('encryption.unlock.forgot') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCryptoStore } from '@/stores/crypto';

const emit = defineEmits<{ (e: 'open-reset'): void }>();
const { t } = useI18n();
const crypto = useCryptoStore();

const password = ref('');
const busy = ref(false);
const wrongAttempt = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const hasError = computed(() => wrongAttempt.value && !busy.value);

onMounted(() => {
  void nextTick(() => inputRef.value?.focus());
});

async function onSubmit(): Promise<void> {
  if (busy.value || password.value.length === 0) return;
  busy.value = true;
  wrongAttempt.value = false;
  try {
    const ok = await crypto.unlock(password.value);
    if (!ok) {
      wrongAttempt.value = true;
      password.value = '';
      void nextTick(() => inputRef.value?.focus());
    }
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.unlock {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--color-bg);
}

.unlock__panel {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: center;
}

.unlock__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

.unlock__icon {
  font-size: 24px;
}

.unlock__title {
  margin: var(--space-3) 0 0;
  font-size: var(--text-2xl, var(--text-lg));
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.unlock__subtitle {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.unlock__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
  text-align: left;
}

.unlock__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.unlock__input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  font-size: var(--text-base);
  color: var(--color-text);
}

.unlock__input[aria-invalid='true'] {
  border-color: var(--color-danger, #c0392b);
}

.unlock__input:disabled {
  opacity: 0.6;
}

.unlock__error {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger, #c0392b);
}

.unlock__submit {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  font-weight: var(--weight-medium);
  border: none;
  cursor: pointer;
}

.unlock__submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.unlock__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.unlock__forgot {
  margin-top: var(--space-4);
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  text-decoration: underline;
}

.unlock__forgot:hover:not(:disabled) {
  color: var(--color-primary-text);
}
</style>
