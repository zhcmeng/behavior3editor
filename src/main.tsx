import { App, ConfigProvider } from "antd";
import React from "react";
import ReactDOM from "react-dom/client";
import { Setup } from "./components/setup";
import { Workspace } from "./components/workspace";
import "./misc/i18n";
import { themeConfig } from "./misc/theme";

// 这里是应用的主入口文件（main.tsx）
// 主要职责：
// - 导入 Ant Design、React 相关依赖和应用主题
// - 渲染应用的根组件，包括 Setup（初始化流程）和 Workspace（主工作区）
// - 设置全局主题样式，并在应用骨架加载完毕后移除 Loading 状态

// 说明：
// - ConfigProvider 提供全局 UI 主题配置
// - App 是 Antd 的全局样式与配置注入点
// - Setup 用于环境初始化（如配置、检测依赖等）
// - Workspace 是实际的主界面内容
// - 最后 message 用于通知主进程移除加载动画
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig}>
      <App>
        <Setup />
        <Workspace />
      </App>
    </ConfigProvider>
  </React.StrictMode>
);

postMessage({ payload: "removeLoading" }, "*");
