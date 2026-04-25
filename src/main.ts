import { createApp } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';

import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import { patchCreateImageBitmap } from './shims/createImageBitmap-svg';

import './styles/variables.css';
import './styles/base.css';

// Designer-core's barcode path uses createImageBitmap on SVG blobs,
// which Chromium does not support. See DECISIONS.md D17.
patchCreateImageBitmap();

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(VueKonva, { prefix: 'V' });

app.mount('#app');
