import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from '@/presentation/router';
import { i18n, initLocale } from '@/presentation/i18n';
import '@/presentation/styles/main.css';

await initLocale();

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app');
