import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from '@/presentation/router';
import '@/presentation/styles/main.css';

createApp(App).use(createPinia()).use(router).mount('#app');
