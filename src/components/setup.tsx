/**
 * Setup 组件 - 应用初始化入口（一次性副作用）
 * 
 * 主要职责：
 * - 初始化设置上下文（加载最近项目、布局设置等）
 * - 通知主进程窗口可显示（ready-to-show）
 * - 安装全局 hooks（消息、弹窗等）
 * 
 * 说明：
 * 该组件不渲染可视内容，仅在应用启动时执行必要的副作用。
 */
import { ipcRenderer } from "electron";
import { FC } from "react";
import { useSetting } from "../contexts/setting-context";
import { message, setGlobalHooks } from "../misc/hooks";

/**
 * Setup 组件
 * 
 * 执行一次性副作用：初始化设置、通知主进程、安装全局 hooks
 */
export const Setup: FC = () => {
  // 防止重复初始化：仅在 message 尚未设置时执行
  if (!message) {
    useSetting().load();
    // 通知主进程：渲染进程已准备好显示窗口
    ipcRenderer.invoke("ready-to-show");
  }
  // 安装全局 Hook（消息、弹窗等）
  setGlobalHooks();
  return <div></div>;
};
