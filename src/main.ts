import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from '@/presentation/router';
import { i18n, initLocale } from '@/presentation/i18n';
import '@/presentation/styles/main.css';

await initLocale();

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app');

const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let resource = input;

  if (
    typeof resource === 'string' &&
    resource.includes('/data/') &&
    !resource.includes('/books.json')
  ) {
    const url = new URL(resource, window.location.origin);
    const newPath = url.pathname.replace('/data/', '/data/old-books/');
    resource = `https://mhkarami97.github.io/english-word${newPath}`;
  }

  return originalFetch(resource, init);
};
