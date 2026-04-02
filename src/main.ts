import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';
import '@/styles/main.scss'; // 引入全局样式

const app = createApp(App);

app.use(createPinia()); // 启用 Pinia
// 不再全局注册 Arco 组件 app.use(ArcoVue); // 启用 Arco Design
app.mount('#app');
