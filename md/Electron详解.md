# Behavior3Editor 中的 Electron 架构详解

## 📋 目录

1. [Electron 基础概念](#electron-基础概念)
2. [项目中的 Electron 架构](#项目中的-electron-架构)
3. [主进程详解](#主进程详解)
4. [预加载脚本详解](#预加载脚本详解)
5. [渲染进程详解](#渲染进程详解)
6. [IPC 通信机制](#ipc-通信机制)
7. [完整的数据流程](#完整的数据流程)
8. [实战案例](#实战案例)

---

## 🎯 Electron 基础概念

### 什么是 Electron？

Electron 是一个使用 Web 技术（HTML、CSS、JavaScript）构建跨平台桌面应用的框架。

### 核心架构：三进程模型

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐                                     │
│  │   主进程 (Main)  │  ← Node.js 完整能力                │
│  │  - 窗口管理      │  ← 文件系统访问                     │
│  │  - 生命周期      │  ← 系统 API                         │
│  │  - IPC 服务端    │                                     │
│  └────────┬────────┘                                     │
│           │ IPC 通信                                      │
│  ┌────────┴────────┐                                     │
│  │ 预加载 (Preload) │  ← 桥接层                          │
│  │  - 安全暴露 API  │  ← contextBridge                   │
│  └────────┬────────┘                                     │
│           │                                               │
│  ┌────────┴────────┐                                     │
│  │ 渲染进程(Render) │  ← Chromium 浏览器环境             │
│  │  - React 应用    │  ← 前端代码                        │
│  │  - UI 界面       │  ← 受限的 Node.js (可配置)         │
│  └─────────────────┘                                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 关键区别

| 特性 | 主进程 | 预加载脚本 | 渲染进程 |
|-----|--------|-----------|---------|
| **运行环境** | Node.js | Node.js + DOM | Chromium |
| **数量** | 1个 | 每个窗口1个 | 多个（每个窗口） |
| **访问权限** | 完整系统权限 | 受限权限 | 沙盒环境 |
| **主要职责** | 窗口管理、系统操作 | API 桥接 | UI 渲染、用户交互 |

---

## 🏗️ 项目中的 Electron 架构

### 文件结构

```
behavior3editor/
├── electron/
│   ├── main/
│   │   └── index.ts          ← 主进程入口
│   └── preload/
│       └── index.ts          ← 预加载脚本
├── src/
│   ├── main.tsx              ← React 应用入口（渲染进程）
│   └── components/           ← UI 组件
├── index.html                ← HTML 模板
├── vite.config.ts            ← Vite + Electron 配置
└── package.json
```

### 构建输出

```
dist-electron/
├── main/
│   └── index.js              ← 编译后的主进程
└── preload/
    └── index.mjs             ← 编译后的预加载脚本

dist/
└── index.html                ← 编译后的渲染进程
    └── assets/
```

---

## 🎮 主进程详解

### 文件：`electron/main/index.ts`

主进程是 Electron 应用的入口点，负责应用的整体生命周期和窗口管理。

### 核心功能模块

#### 1. 命令行参数处理（批处理模式）

```typescript
// electron/main/index.ts:15-31
let buildProject: string | undefined;
let buildOutput: string | undefined;
let buildHelp: boolean = false;

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "-p") {
    buildProject = argv[i + 1];  // 项目路径
    i++;
  } else if (arg === "-o") {
    buildOutput = argv[i + 1];   // 输出路径
    i++;
  } else if (arg === "-h" || arg === "-v") {
    buildHelp = true;
  }
}
```

**用途**：支持命令行批处理编译
```bash
# 无头模式编译项目
behavior3editor -p ./project.b3-workspace -o ./output/
```

**流程**：
1. 解析命令行参数
2. 如果有 `-p` 和 `-o` 参数，进入批处理模式
3. 调用 `b3util.buildProject()` 编译项目
4. 编译完成后退出应用（不打开 GUI）

#### 2. 应用初始化

```typescript
// electron/main/index.ts:103-111
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;
```

**关键配置**：
- `APP_ROOT`：应用根目录
- `VITE_DEV_SERVER_URL`：开发模式下的 Vite 服务器地址
- 区分开发/生产环境的资源路径

```typescript
// electron/main/index.ts:114-122
// 禁用 GPU 加速（Windows 7 兼容）
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// 设置应用名称（Windows 10+ 通知）
if (process.platform === "win32") app.setAppUserModelId(app.getName());

// 单实例锁（防止多开）
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
```

#### 3. 窗口创建和管理

```typescript
// electron/main/index.ts:133-213
async function createWindow(projectPath?: string) {
  const win = new BrowserWindow({
    title: "Behaviour3 Editor",
    icon: Path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    frame: false,              // 隐藏默认边框（自定义标题栏）
    width: 1280,
    height: 800,
    minHeight: 600,
    minWidth: 800,
    titleBarStyle: "hidden",   // 隐藏标题栏
    titleBarOverlay:           // 自定义标题栏覆盖层
      process.platform === "darwin"
        ? true
        : { color: "#0d1117", height: 35, symbolColor: "#7d8590" },
    backgroundColor: "#0d1117",
    trafficLightPosition: { x: 10, y: 10 },  // macOS 红绿灯位置
    webPreferences: {
      preload,                 // 预加载脚本路径
      webSecurity: false,      // 禁用 Web 安全（开发用，生产应启用）
      nodeIntegration: true,   // 启用 Node.js 集成
      contextIsolation: false, // 禁用上下文隔离（不安全，但方便）
    },
  });

  // 多窗口管理
  const workspace = { projectPath, window: win, files: [] };
  windows.push(workspace);

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);    // 开发模式：加载 Vite 服务器
    win.webContents.openDevTools();      // 打开开发者工具
  } else {
    win.maximize();
    win.loadFile(indexHtml);             // 生产模式：加载静态文件
  }

  // 页面加载完成事件
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1);    // 设置缩放比例
    win.focus();
  });

  // 窗口关闭事件
  win.on("closed", () => {
    const index = windows.findIndex((w) => w.window === win);
    windows.splice(index, 1);
    
    // 批处理模式下，最后一个窗口关闭时退出应用
    if (buildOutput && buildProject && windows.length === 0) {
      app.exit(0);
    }
  });

  // 外部链接在浏览器中打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // 启用 @electron/remote
  require("@electron/remote/main").enable(win.webContents);
}
```

**关键点**：
- **自定义标题栏**：`frame: false` + `titleBarStyle: "hidden"`
- **Node.js 集成**：`nodeIntegration: true` + `contextIsolation: false`
  - ⚠️ **安全警告**：这种配置不安全，生产环境应使用 `contextBridge`
  - 优点：方便在渲染进程直接使用 Node.js API
- **@electron/remote**：允许渲染进程直接调用主进程模块

#### 4. 应用生命周期

```typescript
// electron/main/index.ts:215-235
app.whenReady().then(() => {
  require("@electron/remote/main").initialize();
  createWindow();
});

// macOS 特有：所有窗口关闭不退出应用
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 检测到第二个实例启动时，创建新窗口
app.on("second-instance", () => {
  createWindow();
});

// macOS 特有：点击 Dock 图标时激活窗口
app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
```

#### 5. IPC 处理器

```typescript
// electron/main/index.ts:238-272
// 打开新窗口
ipcMain.handle("open-win", (e, arg) => {
  if (arg) {
    let workspace = windows.find((v) => v.projectPath === arg);
    if (workspace) {
      workspace.window.focus();  // 窗口已存在，聚焦
      return;
    }

    workspace = windows.find((v) => v.window.webContents.id === e.sender.id);
    if (workspace && !workspace.projectPath) {
      workspace.projectPath = arg;
      workspace.window.webContents.send("open-project", arg);
      return;
    }
  }

  createWindow(arg);  // 创建新窗口
});

// 窗口准备就绪
ipcMain.handle("ready-to-show", (e) => {
  const workspace = windows.find((v) => v.window.webContents.id === e.sender.id);
  if (workspace && workspace.projectPath) {
    workspace.window.webContents.send("open-project", workspace.projectPath);
  }
});

// 删除文件到回收站
ipcMain.handle("trash-item", (_, arg) => {
  arg = arg.replace(/\//g, path.sep);
  shell.trashItem(arg).catch((e) => console.error(e));
});

// 在文件管理器中显示文件
ipcMain.handle("show-item-in-folder", (_, arg) => {
  arg = arg.replace(/\//g, path.sep);
  shell.showItemInFolder(arg);
});
```

---

## 🔗 预加载脚本详解

### 文件：`electron/preload/index.ts`

预加载脚本在渲染进程创建之前执行，是主进程和渲染进程之间的"桥梁"。

### 当前实现

这个项目使用了**简化模式**，因为禁用了 `contextIsolation`：

```typescript
// electron/preload/index.ts:1-23
// ❌ 注释掉的安全方式（应该使用的）
// contextBridge.exposeInMainWorld("ipcRenderer", {
//   on(...args: Parameters<typeof ipcRenderer.on>) {
//     const [channel, listener] = args;
//     return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
//   },
//   off(...args: Parameters<typeof ipcRenderer.off>) {
//     const [channel, ...omit] = args;
//     return ipcRenderer.off(channel, ...omit);
//   },
//   send(...args: Parameters<typeof ipcRenderer.send>) {
//     const [channel, ...omit] = args;
//     return ipcRenderer.send(channel, ...omit);
//   },
//   invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
//     const [channel, ...omit] = args;
//     return ipcRenderer.invoke(channel, ...omit);
//   },
// });
```

**为什么注释掉？**
- 因为 `contextIsolation: false`，渲染进程可以直接使用 Node.js API
- 不需要通过 `contextBridge` 桥接

**安全问题**：
- ⚠️ 渲染进程可以直接使用 `require('fs')`、`require('electron')` 等
- ⚠️ 如果加载了不可信的内容（如第三方网页），会有安全风险

### 加载动画

```typescript
// electron/preload/index.ts:26-117
function domReady(condition: DocumentReadyState[] = ["complete", "interactive"]) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener("readystatechange", () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

function useLoading() {
  // ... 创建加载动画的样式和 DOM
  return {
    appendLoading() {
      // 添加加载动画（当前被注释）
    },
    removeLoading() {
      // 移除加载动画
    },
  };
}

const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

// 监听来自渲染进程的消息
window.onmessage = (ev) => {
  ev.data.payload === "removeLoading" && removeLoading();
};

// 超时后自动移除加载动画
setTimeout(removeLoading, 4999);
```

---

## 🖼️ 渲染进程详解

### 文件：`src/main.tsx`

渲染进程就是我们的 React 应用，运行在 Chromium 浏览器环境中。

```typescript
// src/main.tsx
import { App, ConfigProvider } from "antd";
import React from "react";
import ReactDOM from "react-dom/client";
import { Setup } from "./components/setup";
import { Workspace } from "./components/workspace";
import "./misc/i18n";
import { themeConfig } from "./misc/theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig}>
      <App>
        <Setup />        {/* 初始化设置组件 */}
        <Workspace />    {/* 工作区主组件 */}
      </App>
    </ConfigProvider>
  </React.StrictMode>
);

// 通知预加载脚本移除加载动画
postMessage({ payload: "removeLoading" }, "*");
```

### 如何使用 Electron API

因为 `nodeIntegration: true` 和 `contextIsolation: false`，可以直接使用：

```typescript
// src/contexts/workspace-context.ts:1-4
import { BrowserWindow, dialog } from "@electron/remote";
import { ipcRenderer } from "electron";
import * as fs from "fs";
```

#### 1. 使用 @electron/remote

直接在渲染进程调用主进程模块：

```typescript
// src/components/menu.tsx:29-31
const getFocusedWebContents = () => {
  return BrowserWindow.getFocusedWindow()?.webContents;
};

// src/components/menu.tsx:64
const homedir = app.getPath("home");

// 显示对话框
const result = await dialog.showOpenDialog({
  title: "打开文件",
  properties: ["openFile"],
  filters: [{ name: "行为树", extensions: ["json"] }],
});
```

**原理**：
- `@electron/remote` 是一个 RPC（远程过程调用）模块
- 渲染进程调用 `BrowserWindow.getFocusedWindow()` 时
- 实际是发送 IPC 消息到主进程
- 主进程执行并返回结果

**优点**：代码简洁，写起来像本地调用
**缺点**：性能开销大，同步调用会阻塞

#### 2. 使用 ipcRenderer

异步通信，性能更好：

```typescript
// src/components/menu.tsx:33-40
// 监听来自主进程的消息
ipcRenderer.on("open-project", (_, dir) => {
  useWorkspace.getState().init(dir);
});

ipcRenderer.on("refresh-app-men", () => {
  useSetting.getState().load();
});

// 发送消息到主进程
ipcRenderer.invoke("open-win", projectPath);
ipcRenderer.invoke("trash-item", filePath);
ipcRenderer.invoke("show-item-in-folder", filePath);
```

#### 3. 使用 Node.js 模块

直接使用文件系统等 Node.js API：

```typescript
// src/contexts/workspace-context.ts:3
import * as fs from "fs";

// 读取文件
const content = fs.readFileSync(path, "utf-8");

// 写入文件
fs.writeFileSync(path, JSON.stringify(data, null, 2));

// 获取文件状态
const mtime = fs.statSync(path).mtimeMs;

// 监听文件变化
fs.watch(dir, (eventType, filename) => {
  // 处理文件变化
});
```

---

## 🔄 IPC 通信机制

IPC（Inter-Process Communication）是主进程和渲染进程之间通信的方式。

### 通信模式

#### 1. 渲染进程 → 主进程（单向）

```typescript
// 渲染进程
ipcRenderer.send("channel-name", data);

// 主进程
ipcMain.on("channel-name", (event, data) => {
  console.log(data);
});
```

#### 2. 渲染进程 → 主进程（请求-响应）

```typescript
// 渲染进程
const result = await ipcRenderer.invoke("channel-name", data);

// 主进程
ipcMain.handle("channel-name", async (event, data) => {
  // 处理请求
  return result;
});
```

#### 3. 主进程 → 渲染进程（单向）

```typescript
// 主进程
win.webContents.send("channel-name", data);

// 渲染进程
ipcRenderer.on("channel-name", (event, data) => {
  console.log(data);
});
```

### 项目中的 IPC 通信示例

#### 示例 1：打开项目

```
┌─────────────────┐         ┌──────────────────┐
│   渲染进程       │         │    主进程         │
│  (menu.tsx)     │         │ (main/index.ts)  │
└────────┬────────┘         └─────────┬────────┘
         │                             │
         │  invoke("open-win", path)  │
         │─────────────────────────────>
         │                             │
         │                     ┌───────┴────────┐
         │                     │ 检查窗口是否存在 │
         │                     │ 创建新窗口或聚焦 │
         │                     └───────┬────────┘
         │                             │
         │   send("open-project")     │
         <─────────────────────────────│
         │                             │
    ┌────┴─────────┐                  │
    │ 初始化工作区  │                  │
    │ 加载行为树    │                  │
    └──────────────┘                  │
```

**代码流程**：

```typescript
// 1. 渲染进程：用户点击"打开项目"
// src/components/menu.tsx
const openProject = async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Workspace", extensions: ["b3-workspace"] }],
  });
  
  if (result.filePaths[0]) {
    await ipcRenderer.invoke("open-win", result.filePaths[0]);
  }
};

// 2. 主进程：处理打开请求
// electron/main/index.ts:238
ipcMain.handle("open-win", (e, arg) => {
  // 检查窗口是否已打开
  let workspace = windows.find((v) => v.projectPath === arg);
  if (workspace) {
    workspace.window.focus();
    return;
  }
  
  // 创建新窗口
  createWindow(arg);
});

// 3. 主进程：通知渲染进程打开项目
// electron/main/index.ts:260
workspace.window.webContents.send("open-project", workspace.projectPath);

// 4. 渲染进程：接收并处理
// src/components/menu.tsx:33
ipcRenderer.on("open-project", (_, dir) => {
  useWorkspace.getState().init(dir);
});
```

#### 示例 2：删除文件

```
┌─────────────────┐         ┌──────────────────┐
│   渲染进程       │         │    主进程         │
│ (workspace.tsx) │         │ (main/index.ts)  │
└────────┬────────┘         └─────────┬────────┘
         │                             │
         │ invoke("trash-item", path) │
         │─────────────────────────────>
         │                             │
         │                     ┌───────┴────────┐
         │                     │ shell.trashItem│
         │                     │ 移动到回收站    │
         │                     └───────┬────────┘
         │                             │
         │      返回结果               │
         <─────────────────────────────│
         │                             │
    ┌────┴─────────┐                  │
    │ 更新文件列表  │                  │
    └──────────────┘                  │
```

**代码流程**：

```typescript
// 1. 渲染进程：用户删除文件
// src/contexts/workspace-context.ts
const deleteFile = async (path: string) => {
  await ipcRenderer.invoke("trash-item", path);
  // 更新状态
};

// 2. 主进程：处理删除请求
// electron/main/index.ts:264
ipcMain.handle("trash-item", (_, arg) => {
  arg = arg.replace(/\//g, path.sep);
  shell.trashItem(arg).catch((e) => console.error(e));
});
```

---

## 🌊 完整的数据流程

### 场景：用户打开并编辑一个行为树文件

```
┌──────────────────────────────────────────────────────────────┐
│                        用户操作流程                            │
└──────────────────────────────────────────────────────────────┘

1. 用户点击"打开项目"
   │
   ├─> Menu.tsx
   │   └─> dialog.showOpenDialog() (通过 @electron/remote)
   │       └─> 选择 .b3-workspace 文件
   │
2. 发送打开请求
   │
   ├─> ipcRenderer.invoke("open-win", projectPath)
   │
3. 主进程处理
   │
   ├─> electron/main/index.ts
   │   ├─> 检查窗口是否已打开
   │   ├─> createWindow(projectPath) 或 focus()
   │   └─> win.webContents.send("open-project", projectPath)
   │
4. 渲染进程接收
   │
   ├─> ipcRenderer.on("open-project", ...)
   │   └─> useWorkspace.getState().init(projectPath)
   │
5. 初始化工作区
   │
   ├─> workspace-context.ts
   │   ├─> 读取 .b3-workspace 配置 (fs.readFileSync)
   │   ├─> 读取 node-config.b3-setting (节点定义)
   │   ├─> 扫描 workdir 目录
   │   └─> 加载所有 .json 行为树文件
   │
6. 更新 UI
   │
   ├─> Workspace.tsx 重新渲染
   │   ├─> Explorer.tsx (显示文件树)
   │   ├─> Editor.tsx (空白画布)
   │   └─> Inspector.tsx (属性面板)
   │
7. 用户点击文件
   │
   ├─> Explorer.tsx
   │   └─> useWorkspace.getState().open(filePath)
   │
8. 加载行为树
   │
   ├─> workspace-context.ts
   │   ├─> 读取 .json 文件 (fs.readFileSync)
   │   ├─> 解析 JSON
   │   ├─> 创建 EditorStore
   │   └─> 更新状态
   │
9. 渲染行为树
   │
   ├─> Editor.tsx
   │   └─> graph.ts (G6)
   │       ├─> 将 TreeData 转换为 G6 数据格式
   │       ├─> 渲染节点和边
   │       └─> 自动布局
   │
10. 用户编辑节点
    │
    ├─> 点击节点
    │   └─> graph.ts: node:click 事件
    │       └─> useWorkspace.getState().focusNode(nodeId)
    │           └─> Inspector.tsx 显示节点属性
    │
    ├─> 修改节点参数
    │   └─> Inspector.tsx
    │       └─> useWorkspace.getState().updateNodeArgs(nodeId, args)
    │           ├─> 更新内存中的 TreeData
    │           ├─> 标记为已修改 (changed = true)
    │           └─> graph.render() 重新渲染
    │
11. 用户保存文件
    │
    ├─> 快捷键 Ctrl+S
    │   └─> Editor.tsx
    │       └─> useWorkspace.getState().save()
    │           ├─> 验证行为树
    │           ├─> JSON.stringify(treeData)
    │           ├─> fs.writeFileSync(path, json)
    │           └─> changed = false
```

### 关键数据结构流转

```typescript
// 1. 工作区配置文件 (.b3-workspace)
interface WorkspaceConfig {
  name: string;
  version: string;
  workdir: string;              // "./workdir"
  settings: string;             // "./node-config.b3-setting"
  vars?: string;                // 可选：变量声明文件
  buildScript?: string;         // 可选：构建脚本
}

// 2. 节点定义配置 (.b3-setting)
interface NodeSettingsConfig {
  version: string;
  nodes: NodeDef[];             // 节点定义列表
  icons?: { [key: string]: string };  // 自定义图标
}

// 3. 行为树文件 (.json)
interface TreeData {
  name: string;
  desc?: string;
  root: string;                 // 根节点 ID
  nodes: { [id: string]: NodeData };
  vars?: VarDecl[];             // 局部变量
  import?: string[];            // 导入的子树
}

// 4. 节点数据
interface NodeData {
  id: string;
  name: string;                 // 节点类型名称
  desc?: string;
  args?: { [key: string]: any }; // 节点参数
  input?: string[];             // 输入变量
  output?: string[];            // 输出变量
  children?: string[];          // 子节点 ID 列表
}

// 5. G6 图形数据
interface G6Data {
  nodes: {
    id: string;
    data: {
      name: string;
      type: string;             // Action/Decorator/Condition/Composite
      icon: string;
      color: string;
      // ...
    };
  }[];
  edges: {
    source: string;
    target: string;
  }[];
}
```

---

## 🎓 实战案例

### 案例 1：添加"导出为图片"功能

#### 需求
用户点击菜单"导出 → PNG"，将当前行为树导出为图片。

#### 实现步骤

**步骤 1：在主进程添加 IPC 处理器**

```typescript
// electron/main/index.ts
import { nativeImage } from "electron";

ipcMain.handle("export-image", async (event, dataURL) => {
  // 显示保存对话框
  const result = await dialog.showSaveDialog({
    title: "导出图片",
    defaultPath: "behavior-tree.png",
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  });
  
  if (result.filePath) {
    // 将 Data URL 转换为图片
    const image = nativeImage.createFromDataURL(dataURL);
    const buffer = image.toPNG();
    
    // 保存文件
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  }
  
  return { success: false };
});
```

**步骤 2：在渲染进程调用**

```typescript
// src/components/editor.tsx
import { ipcRenderer } from "electron";

const exportImage = async () => {
  // 获取 G6 画布
  const canvas = graph.canvas.getContextService().getDomElement();
  
  // 转换为 Data URL
  const dataURL = canvas.toDataURL("image/png");
  
  // 调用主进程导出
  const result = await ipcRenderer.invoke("export-image", dataURL);
  
  if (result.success) {
    message.success(`导出成功：${result.path}`);
  }
};
```

**步骤 3：在菜单中添加选项**

```typescript
// src/components/menu.tsx
const menuTemplate: MenuItemConstructorOptions[] = [
  // ...
  {
    id: "menu.export",
    label: t("export"),
    submenu: [
      {
        id: "menu.export.png",
        label: "PNG 图片",
        click: () => {
          // 触发导出
          useWorkspace.getState().dispatch?.("export-image");
        },
      },
    ],
  },
];
```

---

### 案例 2：添加文件监听（自动重载）

#### 需求
当文件在外部被修改时，自动提示用户重新加载。

#### 实现步骤

**步骤 1：在主进程监听文件变化**

```typescript
// electron/main/index.ts
import * as chokidar from "chokidar";

const watchers = new Map<number, chokidar.FSWatcher>();

ipcMain.handle("watch-file", (event, filePath) => {
  const webContentsId = event.sender.id;
  
  // 创建文件监听器
  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
  });
  
  watcher.on("change", () => {
    // 通知渲染进程
    event.sender.send("file-changed", filePath);
  });
  
  watchers.set(webContentsId, watcher);
});

ipcMain.handle("unwatch-file", (event) => {
  const webContentsId = event.sender.id;
  const watcher = watchers.get(webContentsId);
  
  if (watcher) {
    watcher.close();
    watchers.delete(webContentsId);
  }
});
```

**步骤 2：在渲染进程使用**

```typescript
// src/contexts/workspace-context.ts
import { ipcRenderer } from "electron";

// 打开文件时开始监听
const open = (path: string) => {
  // ... 加载文件
  
  // 开始监听
  ipcRenderer.invoke("watch-file", path);
};

// 监听文件变化
ipcRenderer.on("file-changed", (_, path) => {
  const store = useWorkspace.getState();
  const editor = store.editors.find((e) => e.path === path);
  
  if (editor) {
    // 检查是否有未保存的修改
    if (editor.changed) {
      // 提示用户
      Modal.confirm({
        title: "文件已被外部修改",
        content: "是否重新加载？未保存的修改将丢失。",
        onOk: () => {
          // 重新加载
          store.reload(path);
        },
      });
    } else {
      // 自动重新加载
      store.reload(path);
      message.info("文件已重新加载");
    }
  }
});

// 关闭文件时停止监听
const close = (path: string) => {
  // ... 关闭文件
  
  ipcRenderer.invoke("unwatch-file");
};
```

---

### 案例 3：添加拖放文件打开功能

#### 需求
用户拖放 `.b3-workspace` 文件到窗口，自动打开项目。

#### 实现步骤

**步骤 1：在渲染进程添加拖放处理**

```typescript
// src/components/workspace.tsx
import { ipcRenderer } from "electron";

useEffect(() => {
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer?.files || []);
    const workspaceFile = files.find((f) => f.path.endsWith(".b3-workspace"));
    
    if (workspaceFile) {
      // 打开项目
      ipcRenderer.invoke("open-win", workspaceFile.path);
    }
  };
  
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  document.addEventListener("drop", handleDrop);
  document.addEventListener("dragover", handleDragOver);
  
  return () => {
    document.removeEventListener("drop", handleDrop);
    document.removeEventListener("dragover", handleDragOver);
  };
}, []);
```

---

## 🔐 安全性建议

### 当前配置的安全问题

```typescript
webPreferences: {
  nodeIntegration: true,      // ❌ 危险
  contextIsolation: false,    // ❌ 危险
  webSecurity: false,         // ❌ 危险
}
```

**风险**：
- 如果加载了不可信的内容（如第三方网站）
- XSS 攻击可以执行任意 Node.js 代码
- 可以读写文件系统、执行系统命令

### 推荐的安全配置

```typescript
webPreferences: {
  preload,
  nodeIntegration: false,     // ✅ 禁用 Node.js 集成
  contextIsolation: true,     // ✅ 启用上下文隔离
  webSecurity: true,          // ✅ 启用 Web 安全
}
```

### 使用 contextBridge

**修改预加载脚本**：

```typescript
// electron/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";

// 安全地暴露 API
contextBridge.exposeInMainWorld("electronAPI", {
  // 文件系统操作
  readFile: (path: string) => ipcRenderer.invoke("read-file", path),
  writeFile: (path: string, data: string) => ipcRenderer.invoke("write-file", path, data),
  
  // 对话框
  showOpenDialog: (options: any) => ipcRenderer.invoke("show-open-dialog", options),
  showSaveDialog: (options: any) => ipcRenderer.invoke("show-save-dialog", options),
  
  // 事件监听
  onOpenProject: (callback: (path: string) => void) => {
    ipcRenderer.on("open-project", (_, path) => callback(path));
  },
});
```

**在渲染进程使用**：

```typescript
// src/contexts/workspace-context.ts
declare global {
  interface Window {
    electronAPI: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, data: string) => Promise<void>;
      showOpenDialog: (options: any) => Promise<any>;
      showSaveDialog: (options: any) => Promise<any>;
      onOpenProject: (callback: (path: string) => void) => void;
    };
  }
}

// 使用
const content = await window.electronAPI.readFile(path);
await window.electronAPI.writeFile(path, content);
```

---

## 📚 总结

### Electron 三进程模型

| 进程 | 职责 | 技术 | 文件 |
|-----|------|------|------|
| **主进程** | 窗口管理、系统操作、IPC 服务端 | Node.js | `electron/main/index.ts` |
| **预加载脚本** | API 桥接、安全隔离 | Node.js + DOM | `electron/preload/index.ts` |
| **渲染进程** | UI 渲染、用户交互 | Chromium + React | `src/main.tsx` |

### 通信方式

1. **@electron/remote**：渲染进程直接调用主进程模块（简单但慢）
2. **ipcRenderer/ipcMain**：异步消息传递（推荐）
3. **contextBridge**：安全地暴露 API（最安全）

### 学习路径

1. ✅ 理解三进程模型和 IPC 通信
2. ✅ 阅读 `electron/main/index.ts`（主进程入口）
3. ✅ 理解窗口创建和生命周期
4. ✅ 学习如何在渲染进程使用 Electron API
5. ✅ 实践添加新功能（IPC 通信）
6. ⭐ 考虑安全性改进（contextBridge）

### 下一步

- 尝试添加自定义功能（导出图片、文件监听等）
- 学习 Electron 的打包和分发
- 研究性能优化（多窗口、大文件处理）
- 提升安全性（contextIsolation + contextBridge）

---

## 🔗 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [进程模型](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [IPC 通信](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [安全性](https://www.electronjs.org/docs/latest/tutorial/security)
- [contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- [@electron/remote](https://github.com/electron/remote)

