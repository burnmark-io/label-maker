import { createRouter, createWebHashHistory } from 'vue-router';

const EditorView = (): Promise<unknown> => import('./views/EditorView.vue');

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorView,
    },
  ],
});
