import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';
import '@/styles/main.scss'; // 引入全局样式

const app = createApp(App);

app.use(createPinia()); // 启用 Pinia
app.use(ArcoVue); // 启用 Arco Design
app.mount('#app');
