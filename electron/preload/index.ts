/**
 * Electron 预加载脚本 (Preload Script)
 * 
 * 预加载脚本是 Electron 安全架构的关键部分：
 * - 在渲染进程创建之前执行
 * - 可以访问 Node.js API 和 DOM API
 * - 是主进程和渲染进程之间的"桥梁"
 * 
 * 主要职责：
 * 1. 安全地暴露 API 给渲染进程（通过 contextBridge）
 * 2. 提供加载动画（提升用户体验）
 * 3. 初始化渲染进程所需的环境
 * 
 * 执行时机：
 * ┌──────────────────────────────────────────┐
 * │ 1. 主进程创建 BrowserWindow              │
 * │ 2. 执行预加载脚本 (此文件)               │
 * │ 3. 加载 HTML 页面                        │
 * │ 4. 执行渲染进程 JavaScript (React 应用)  │
 * └──────────────────────────────────────────┘
 */

// ============================================
// 第一部分：安全 API 暴露（已禁用）
// ============================================

/**
 * ⚠️ 推荐的安全方式（当前被注释）
 * 
 * 使用 contextBridge.exposeInMainWorld 安全地暴露 API
 * 
 * 为什么被注释？
 * - 因为主进程配置了 contextIsolation: false
 * - 渲染进程可以直接使用 require('electron') 和 require('fs')
 * - 这种方式更方便，但不安全
 * 
 * 推荐做法：
 * 1. 主进程设置 contextIsolation: true
 * 2. 取消下面代码的注释
 * 3. 渲染进程通过 window.electronAPI 访问
 * 
 * 示例：
 * // 渲染进程
 * window.electronAPI.send('channel', data);
 * const result = await window.electronAPI.invoke('channel', data);
 */

import { contextBridge, ipcRenderer } from "electron";
if ((process as any)?.contextIsolated) {
    contextBridge.exposeInMainWorld("electronAPI", {
        // 监听主进程消息
        on(...args: Parameters<typeof ipcRenderer.on>) {
            const [channel, listener] = args;
            return ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest));
        },
        // 取消监听
        off(...args: Parameters<typeof ipcRenderer.off>) {
            const [channel, ...omit] = args;
            return ipcRenderer.off(channel, ...omit);
        },
        // 发送单向消息
        send(...args: Parameters<typeof ipcRenderer.send>) {
            const [channel, ...omit] = args;
            return ipcRenderer.send(channel, ...omit);
        },
        // 发送请求并等待响应
        invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
            const [channel, ...omit] = args;
            return ipcRenderer.invoke(channel, ...omit);
        },
    });
}
// 可以在这里暴露其他需要的 API
// 例如：文件系统、对话框等
// ...
// });

// 暴露 process 对象（提供平台信息等）
// contextBridge.exposeInMainWorld("process", process);

// ============================================
// 第二部分：加载动画系统
// ============================================

/**
 * DOM 就绪检测
 * 
 * 等待 DOM 加载到指定状态
 * 
 * @param condition 期望的文档状态数组
 *   - "loading": 文档正在加载
 *   - "interactive": 文档已解析，但资源仍在加载
 *   - "complete": 文档和所有资源都已加载完成
 * 
 * @returns Promise，当文档达到指定状态时 resolve
 * 
 * 使用场景：
 * 在操作 DOM 之前确保 DOM 已经就绪
 */
function domReady(condition: DocumentReadyState[] = ["complete", "interactive"]) {
    return new Promise((resolve) => {
        // 如果文档已经处于目标状态，立即 resolve
        if (condition.includes(document.readyState)) {
            resolve(true);
        } else {
            // 否则监听状态变化
            document.addEventListener("readystatechange", () => {
                if (condition.includes(document.readyState)) {
                    resolve(true);
                }
            });
        }
    });
}

/**
 * 安全的 DOM 操作工具
 * 
 * 防止重复添加或删除不存在的元素
 * 避免 DOM 操作异常
 */
const safeDOM = {
    /**
     * 安全地添加子元素
     * 只有当子元素不存在时才添加
     */
    append(parent: HTMLElement, child: HTMLElement) {
        if (!Array.from(parent.children).find((e) => e === child)) {
            return parent.appendChild(child);
        }
    },

    /**
     * 安全地移除子元素
     * 只有当子元素存在时才移除
     */
    remove(parent: HTMLElement, child: HTMLElement) {
        if (Array.from(parent.children).find((e) => e === child)) {
            return parent.removeChild(child);
        }
    },
};

/**
 * 加载动画管理器
 * 
 * 在应用启动时显示加载动画，提升用户体验
 * 
 * 动画效果来源：
 * - https://tobiasahlin.com/spinkit
 * - https://connoratherton.com/loaders
 * - https://projects.lukehaas.me/css-loaders
 * - https://matejkustec.github.io/SpinThatShit
 * 
 * 工作流程：
 * 1. 页面加载时显示加载动画
 * 2. React 应用初始化完成后移除动画
 * 3. 或超时 5 秒后自动移除
 * 
 * @returns {Object} 包含 appendLoading 和 removeLoading 方法
 */
function useLoading() {
    const className = `loaders-css__square-spin`;

    /**
     * CSS 样式定义
     * 
     * 包含：
     * 1. square-spin 动画：3D 旋转的方块
     * 2. 方块样式：50x50 白色方块
     * 3. 容器样式：全屏居中深色背景
     */
    const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;      /* 固定定位，覆盖整个视口 */
  top: 0;
  left: 0;
  width: 100vw;         /* 100% 视口宽度 */
  height: 100vh;        /* 100% 视口高度 */
  display: flex;        /* Flexbox 布局 */
  align-items: center;  /* 垂直居中 */
  justify-content: center;  /* 水平居中 */
  background: #282c34;  /* 深色背景 */
  z-index: 9;           /* 层级：在其他元素之上 */
}
    `;

    // 创建 DOM 元素
    const oStyle = document.createElement("style");  // <style> 标签
    const oDiv = document.createElement("div");      // 容器 <div>

    // 配置样式元素
    oStyle.id = "app-loading-style";
    oStyle.innerHTML = styleContent;

    // 配置容器元素
    oDiv.className = "app-loading-wrap";
    oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

    return {
        /**
         * 添加加载动画
         * 
         * 将样式和动画元素添加到页面
         * 
         * ⚠️ 注意：当前被注释掉了
         * 可能是因为觉得加载速度足够快，不需要动画
         */
        appendLoading() {
            // safeDOM.append(document.head, oStyle);  // 添加样式到 <head>
            // safeDOM.append(document.body, oDiv);    // 添加动画到 <body>
        },

        /**
         * 移除加载动画
         * 
         * 从页面中移除样式和动画元素
         * 
         * 触发时机：
         * 1. React 应用发送 "removeLoading" 消息
         * 2. 超时 5 秒自动移除
         */
        removeLoading() {
            safeDOM.remove(document.head, oStyle);  // 移除样式
            safeDOM.remove(document.body, oDiv);    // 移除动画
        },
    };
}

// ============================================
// 第三部分：初始化和执行
// ============================================

/**
 * 加载动画的生命周期管理
 * 
 * 完整流程：
 * ┌─────────────────────────────────────────────────────┐
 * │ 1. 预加载脚本执行                                    │
 * │    └─> 等待 DOM 就绪                                │
 * │                                                      │
 * │ 2. DOM 就绪（interactive/complete）                 │
 * │    └─> appendLoading() (当前被注释)                 │
 * │                                                      │
 * │ 3. HTML 加载完成                                     │
 * │    └─> React 应用开始初始化                         │
 * │                                                      │
 * │ 4. React 应用就绪                                    │
 * │    └─> 发送 "removeLoading" 消息                    │
 * │        └─> removeLoading() 移除动画                 │
 * │                                                      │
 * │ 或者                                                 │
 * │                                                      │
 * │ 5. 超时 5 秒                                         │
 * │    └─> removeLoading() 自动移除                     │
 * └─────────────────────────────────────────────────────┘
 */

// 创建加载动画管理器
const { appendLoading, removeLoading } = useLoading();

/**
 * 步骤 1：等待 DOM 就绪后添加加载动画
 * 
 * 当 DOM 解析完成（interactive）或完全加载（complete）后
 * 调用 appendLoading() 显示加载动画
 * 
 * ⚠️ 注意：由于 appendLoading() 内部被注释，实际不会显示动画
 */
domReady().then(appendLoading);

/**
 * 步骤 2：监听来自渲染进程的消息
 * 
 * React 应用在初始化完成后会发送消息：
 * postMessage({ payload: "removeLoading" }, "*");
 * 
 * 这是正常的移除时机（应用已经可以交互）
 * 
 * 通信方式：
 * - 渲染进程：window.postMessage()
 * - 预加载脚本：window.onmessage
 * 
 * 这是一种简单的同源通信方式，不需要 IPC
 */
window.onmessage = (ev) => {
    // 检查消息内容是否为 "removeLoading"
    ev.data.payload === "removeLoading" && removeLoading();
};

/**
 * 步骤 3：超时保护机制
 * 
 * 如果 5 秒后仍未收到 "removeLoading" 消息
 * 自动移除加载动画，防止永久显示
 * 
 * 可能的原因：
 * - React 应用初始化失败
 * - 消息发送失败
 * - 网络资源加载缓慢
 * 
 * 4999ms ≈ 5秒（避免整数，降低与其他定时器冲突的概率）
 */
setTimeout(removeLoading, 4999);
