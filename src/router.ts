import { createRouter, createWebHistory } from 'vue-router';

const EditorView = (): Promise<unknown> => import('./views/EditorView.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorView,
    },
    {
      path: '/:pathMatch(.*)*',
      component: EditorView,
    },
  ],
});
