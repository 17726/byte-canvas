import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '@/styles/main.scss'; // 引入全局样式

const app = createApp(App);

app.use(createPinia()); // 启用 Pinia
app.mount('#app');
