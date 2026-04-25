import { createApp } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { registerSW } from 'virtual:pwa-register';

import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import { patchCreateImageBitmap } from './shims/createImageBitmap-svg';
import { useDataStore } from './stores/data';

import './styles/variables.css';
import './styles/base.css';

registerSW({ immediate: true });

// Designer-core's barcode path uses createImageBitmap on SVG blobs,
// which Chromium does not support. See DECISIONS.md D17.
patchCreateImageBitmap();

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(VueKonva, { prefix: 'V' });

// Hydrate the global dataset pool from IndexedDB before mounting so the
// canvas substitution preview and the dataset switcher have data on
// first paint. Errors are swallowed — if IDB is unavailable, the store
// just starts empty.
void useDataStore().hydrate();

app.mount('#app');
