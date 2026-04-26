import { createApp } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { registerSW } from 'virtual:pwa-register';

import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import { patchCreateImageBitmap } from './shims/createImageBitmap-svg';
import { useCryptoStore } from './stores/crypto';
import { useDataStore } from './stores/data';
import { hydrateMappings } from './services/column-mapper';

import './styles/variables.css';
import './styles/base.css';

registerSW({ immediate: true });

// Designer-core's barcode path uses createImageBitmap on SVG blobs,
// which Chromium does not support. See DECISIONS.md D17.
patchCreateImageBitmap();

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(i18n);
app.use(VueKonva, { prefix: 'V' });

// Boot gate. Read the encryption flag *before* hydrating any other store —
// when encryption is on we render the unlock screen instead of the
// editor, and stores must not pre-fetch ciphertext into memory only to
// have to throw it away after unlock.
async function boot(): Promise<void> {
  const cryptoStore = useCryptoStore();
  await cryptoStore.init();
  if (!cryptoStore.locked) {
    // Plaintext (encryption disabled) — hydrate eagerly as before.
    await hydrateMappings();
    void useDataStore().hydrate();
  }
  app.mount('#app');
}

void boot();
