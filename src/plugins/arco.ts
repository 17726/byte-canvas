import type { App } from 'vue';
import {
  Button,
  ButtonGroup,
  ColorPicker,
  Col,
  Divider,
  Empty,
  InputNumber,
  Layout,
  LayoutSider,
  LayoutContent,
  Menu,
  Modal,
  Option,
  Popover,
  PageHeader,
  RadioGroup,
  Radio,
  Row,
  Slider,
  Select,
  SubMenu,
  Textarea,
  Tooltip,
} from '@arco-design/web-vue';

export function installArco(app: App) {
  app.component('a-layout', Layout);
  app.component('a-layout-sider', LayoutSider);
  app.component('a-layout-content', LayoutContent);
  app.component('a-tooltip', Tooltip);
  app.component('a-button', Button);
  app.component('a-slider', Slider);
  app.component('a-select', Select);
  app.component('a-option', Option);
  app.component('a-menu', Menu);
  app.component('a-menu-item', Menu.Item);
  app.component('a-sub-menu', SubMenu);
  app.component('a-button-group', ButtonGroup);
  app.component('a-divider', Divider);
  app.component('a-modal', Modal);
  app.component('a-color-picker', ColorPicker);
  app.component('a-popover', Popover);
  app.component('a-input-number', InputNumber);
  app.component('a-page-header', PageHeader);
  app.component('a-textarea', Textarea);
  app.component('a-empty', Empty);
  app.component('a-row', Row);
  app.component('a-col', Col);
  app.component('a-radio-group', RadioGroup);
  app.component('a-radio', Radio);
}
