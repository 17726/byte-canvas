import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';
import './styles/main.scss'; // 引入全局样式
import { installArco } from './plugins/arco'; // 引入 Arco Design 插件安装函数

const app = createApp(App);
installArco(app);

app.use(createPinia()); // 启用 Pinia
app.mount('#app');
