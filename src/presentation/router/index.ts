import { createRouter, createWebHistory } from 'vue-router';
import { APP_NAME } from '@/config/app';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    immersive?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: 'Home' } },
    { path: '/today', name: 'today', component: () => import('../views/TodayView.vue'), meta: { title: 'Today' } },
    { path: '/review', name: 'review', component: () => import('../views/ReviewView.vue'), meta: { title: 'Review', immersive: true } },
    { path: '/library', name: 'library', component: () => import('../views/LibraryView.vue'), meta: { title: 'Library' } },
    { path: '/library/:bookId', name: 'units', component: () => import('../views/UnitListView.vue'), meta: { title: 'Units' } },
    { path: '/unit/:unitId', name: 'unit', component: () => import('../views/UnitDetailView.vue'), meta: { title: 'Unit' } },
    { path: '/study/unit/:unitId', name: 'study-unit', component: () => import('../views/StudyView.vue'), meta: { title: 'Study', immersive: true } },
    { path: '/study/favorites', name: 'study-favorites', component: () => import('../views/StudyView.vue'), meta: { title: 'Study favorites', immersive: true } },
    { path: '/search', name: 'search', component: () => import('../views/SearchView.vue'), meta: { title: 'Search' } },
    { path: '/favorites', name: 'favorites', redirect: { name: 'library', query: { tab: 'favorites' } } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Settings' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page not found' } },
  ],
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - ${APP_NAME}` : APP_NAME;
});
