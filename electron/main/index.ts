/**
 * Electron 主进程入口文件
 * 
 * 主要职责：
 * 1. 窗口管理：创建、关闭、聚焦窗口
 * 2. 生命周期管理：应用启动、退出
 * 3. IPC 通信：处理来自渲染进程的请求
 * 4. 批处理模式：支持命令行编译项目
 * 5. 系统集成：文件操作、对话框、菜单等
 */

// ============ Electron 核心模块 ============
import { app, BrowserWindow, ipcMain, shell } from "electron";
// app: 控制应用程序的生命周期
// BrowserWindow: 创建和管理窗口
// ipcMain: 主进程的 IPC 通信模块
// shell: 与系统 Shell 交互（打开文件、URL等）

// ============ Node.js 核心模块 ============
import * as fs from "fs"; // 文件系统操作
import { createRequire } from "node:module"; // 在 ESM 中使用 require
import os from "node:os"; // 操作系统信息
import path from "node:path"; // 路径处理
import { argv } from "node:process"; // 命令行参数
import { fileURLToPath } from "node:url"; // URL 转文件路径

// ============ 项目模块 ============
import { VERSION } from "../../src/misc/b3type"; // 版本号
import * as b3util from "../../src/misc/b3util"; // 行为树工具函数
import Path from "../../src/misc/path"; // 自定义路径工具

// ============ ESM 兼容性处理 ============
// 因为使用了 ES Module，需要手动创建 require 和 __dirname
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================
// 第一部分：命令行参数处理（批处理模式）
// ============================================
/**
 * 支持命令行批处理编译，用于 CI/CD 或脚本自动化
 * 
 * 使用示例：
 * behavior3editor -p ./project.b3-workspace -o ./output/
 * 
 * 这样可以在不打开 GUI 的情况下编译项目
 */

// 批处理模式的参数
let buildProject: string | undefined;  // -p 参数：项目文件路径 (.b3-workspace)
let buildOutput: string | undefined;   // -o 参数：编译输出目录
let buildHelp: boolean = false;        // -h/-v 参数：显示帮助信息

// 解析命令行参数
// process.argv 格式：[electron路径, 主文件路径, ...用户参数]
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "-p") {
    buildProject = argv[i + 1];  // 获取项目路径
    i++;  // 跳过下一个参数（因为已经读取）
  } else if (arg === "-o") {
    buildOutput = argv[i + 1];   // 获取输出路径
    i++;
  } else if (arg === "-h" || arg === "-v") {
    buildHelp = true;            // 显示帮助信息
  }
}

// 测试用的硬编码路径（已注释）
// buildProject = "D:/Users/bite/Desktop/work/bit-common/btree/btree.b3-workspace";
// buildOutput = "C:/Users/bite/Codetypes/bit-client/assets/resources/data/btree";

/**
 * 打印帮助信息
 */
const printHelp = () => {
  console.log(`Usage: Behavior3 Editor ${VERSION} [options]`);
  console.log("Options:");
  console.log("  -p <path>    Set the project path");
  console.log("  -o <path>    Set the build output path");
  console.log("  -h -v        Print this help");
};

/**
 * 批处理模式执行流程
 * 
 * 如果检测到命令行参数，进入批处理模式：
 * 1. 验证参数
 * 2. 编译项目
 * 3. 退出应用（不打开 GUI）
 */
if (buildOutput || buildProject || buildHelp) {
  // 情况1：显示帮助信息
  if (buildHelp) {
    printHelp();
    app.quit();
    process.exit(1);
  } 
  // 情况2：参数不完整
  else if (!buildOutput || !buildProject) {
    console.error("build output or project is not set");
    printHelp();
    app.quit();
    process.exit(1);
  }
  
  // 情况3：执行批处理编译
  try {
    // 将路径转换为 POSIX 格式（统一使用 /）
    const project = Path.posixPath(Path.resolve(buildProject!));
    const buildDir = Path.posixPath(Path.resolve(buildOutput!));
    console.log("start build project:", project);
    
    // 验证项目文件扩展名
    if (!project.endsWith(".b3-workspace")) {
      throw new Error(`'${project}' is not a workspace`);
    }
    
    // 获取工作目录（项目文件所在目录）
    const workdir = Path.dirname(project);
    
    // 初始化工作目录（读取配置、节点定义等）
    b3util.initWorkdir(workdir, (msg) => {
      console.error(`${msg}`);
    });
    
    // 禁用 debug 日志（批处理模式只显示关键信息）
    console.debug = () => {};

    // 扫描工作目录中的所有 JSON 文件（行为树文件）
    const files = Path.ls(workdir, true);  // true: 递归扫描
    for (const file of files) {
      if (file.endsWith(".json")) {
        // 记录文件的修改时间（用于增量编译）
        const path = Path.relative(workdir, file).replaceAll(Path.sep, "/");
        b3util.files[path] = fs.statSync(file).mtimeMs;
      }
    }

    // 执行编译
    const hasError = await b3util.buildProject(project, buildDir);
    
    if (hasError) {
      console.error("build failed***");
      app.quit();
      process.exit(1);  // 返回错误码 1
    } else {
      console.log("build completed");
    }
  } catch (error) {
    console.error("build failed***");
    app.quit();
    process.exit(1);
  }
  
  // 编译完成，退出应用
  app.quit();
  process.exit(0);  // 返回成功码 0
}

// ============================================
// 第二部分：应用初始化配置
// ============================================

/**
 * 构建后的目录结构
 *
 * ├─┬ dist-electron          (Electron 进程代码)
 * │ ├─┬ main
 * │ │ └── index.js          > 主进程
 * │ └─┬ preload
 * │   └── index.mjs         > 预加载脚本
 * ├─┬ dist                  (渲染进程代码)
 * │ └── index.html          > React 应用
 */

// 应用根目录（向上两级：dist-electron/main -> behavior3editor）
process.env.APP_ROOT = path.join(__dirname, "../..");

// 导出路径常量，供其他模块使用
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// 公共资源目录（图标、静态文件等）
// 开发模式：使用 public 目录
// 生产模式：使用 dist 目录（资源会被复制过去）
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

/**
 * 系统兼容性配置
 */

// Windows 7 兼容：禁用 GPU 加速
// Windows 7 版本号以 "6.1" 开头
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Windows 10+ 通知：设置应用用户模型 ID
// 这样通知才能正确显示应用名称和图标
if (process.platform === "win32") app.setAppUserModelId(app.getName());

/**
 * 单实例锁：防止应用被多次启动
 * 
 * 如果应用已经在运行：
 * - requestSingleInstanceLock() 返回 false
 * - 当前实例退出
 * - 已运行的实例会收到 'second-instance' 事件
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ============================================
// 第三部分：窗口管理
// ============================================

/**
 * 工作区接口：关联窗口和项目
 * 一个窗口对应一个工作区（项目）
 */
interface Workspace {
  projectPath?: string;    // 项目文件路径（.b3-workspace）
  window: BrowserWindow;   // 对应的窗口实例
}

// 预加载脚本路径
const preload = path.join(__dirname, "../preload/index.mjs");
// HTML 入口文件路径
const indexHtml = path.join(RENDERER_DIST, "index.html");
// 所有打开的窗口列表（支持多窗口）
const windows: Workspace[] = [];

/**
 * 创建应用窗口
 * 
 * @param projectPath 可选的项目路径，如果提供则自动打开该项目
 * 
 * 窗口创建流程：
 * 1. 配置窗口选项（大小、样式、安全设置等）
 * 2. 加载页面（开发模式加载 Vite 服务器，生产模式加载静态文件）
 * 3. 注册事件监听器（加载完成、关闭等）
 * 4. 启用 @electron/remote（允许渲染进程调用主进程模块）
 */
async function createWindow(projectPath?: string) {
  const win = new BrowserWindow({
    // 基础配置
    title: "Behaviour3 Editor",
    icon: Path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    
    // 窗口样式：无边框 + 自定义标题栏
    frame: false,                    // 隐藏系统默认边框
    titleBarStyle: "hidden",         // 隐藏标题栏
    titleBarOverlay:                 // 标题栏覆盖层配置
      process.platform === "darwin"  // macOS
        ? true                       // 使用默认样式
        : { color: "#0d1117", height: 35, symbolColor: "#7d8590" },  // Windows/Linux
    
    // 窗口大小
    width: 1280,
    height: 800,
    minHeight: 600,                  // 最小高度
    minWidth: 800,                   // 最小宽度
    
    // 窗口控制按钮
    closable: true,                  // 可关闭
    minimizable: true,               // 可最小化
    maximizable: true,               // 可最大化
    
    // 外观
    backgroundColor: "#0d1117",      // 背景色（GitHub Dark 风格）
    trafficLightPosition: { x: 10, y: 10 },  // macOS 红绿灯位置
    
    /**
     * Web 偏好设置（安全性和功能）
     * 
     * ⚠️ 安全警告：
     * 当前配置为了开发方便，禁用了上下文隔离和 Web 安全
     * 生产环境应该：
     * - nodeIntegration: false
     * - contextIsolation: true
     * - webSecurity: true
     * - 使用 contextBridge 安全地暴露 API
     */
    webPreferences: {
      preload,                       // 预加载脚本路径
      
      // 安全设置（当前配置不安全，仅用于开发）
      webSecurity: false,            // ❌ 禁用 Web 安全策略
      nodeIntegration: true,         // ❌ 允许渲染进程使用 Node.js
      contextIsolation: false,       // ❌ 禁用上下文隔离
      
      // 推荐的安全配置（已注释）：
      // webSecurity: true,
      // nodeIntegration: false,
      // contextIsolation: true,
      // 然后在 preload 中使用 contextBridge.exposeInMainWorld() 暴露 API
    },
  });

  // 创建工作区对象并加入列表
  const workspace = { projectPath, window: win, files: [] };
  windows.push(workspace);

  // 确保窗口可最大化
  win.maximizable = true;

  /**
   * 加载页面内容
   * 
   * 开发模式：连接到 Vite 开发服务器（支持热更新）
   * 生产模式：加载静态 HTML 文件
   */
  if (VITE_DEV_SERVER_URL) {
    // 开发模式
    win.loadURL(VITE_DEV_SERVER_URL);
    // 自动打开开发者工具
    win.webContents.openDevTools();
  } else {
    // 生产模式
    win.maximize();                    // 最大化窗口
    win.loadFile(indexHtml);           // 加载静态文件
  }

  /**
   * 页面加载完成事件
   * 
   * 当 HTML 和 CSS 加载完成后触发
   * 此时 React 应用开始初始化
   */
  win.webContents.on("did-finish-load", () => {
    // 设置缩放比例为 100%（防止系统缩放影响）
    win.webContents.setZoomFactor(1);

    // 如果有多个窗口，聚焦最新的窗口
    const nextWin = BrowserWindow.getAllWindows().at(-1);
    if (nextWin) {
      nextWin.focus();
      // 通知渲染进程刷新应用菜单
      nextWin.webContents.send("refresh-app-men");
    }

    // 聚焦当前窗口
    win.focus();
  });

  /**
   * 窗口关闭事件
   * 
   * 清理工作：
   * 1. 从窗口列表中移除
   * 2. 批处理模式下，最后一个窗口关闭时退出应用
   */
  win.on("closed", () => {
    // 从窗口列表中移除
    const index = windows.findIndex((w) => w.window === win);
    windows.splice(index, 1);

    // 批处理模式：所有窗口关闭后退出
    if (buildOutput && buildProject && windows.length === 0) {
      app.exit(0);
    } else {
      // 清除批处理参数（允许正常使用 GUI）
      buildOutput = undefined;
      buildProject = undefined;
    }
  });

  /**
   * 外部链接处理
   * 
   * 当页面中的链接被点击时：
   * - HTTPS 链接：在默认浏览器中打开
   * - 其他链接：阻止打开（安全考虑）
   */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };  // 阻止在应用内打开新窗口
  });

  /**
   * 启用 @electron/remote
   * 
   * 允许渲染进程直接调用主进程模块：
   * - dialog: 对话框
   * - BrowserWindow: 窗口操作
   * - app: 应用信息
   * - shell: 系统集成
   * 
   * ⚠️ 注意：这是一个便利功能，但有性能开销
   * 推荐使用 IPC 通信代替
   */
  require("@electron/remote/main").enable(win.webContents);

  // 自动更新功能（已禁用）
  // update(win);
}

// ============================================
// 第四部分：应用生命周期事件
// ============================================

/**
 * 'ready' 事件：应用启动完成
 * 
 * 当 Electron 完成初始化后触发
 * 这是创建窗口的最佳时机
 */
app.whenReady().then(() => {
  // 初始化 @electron/remote 模块
  require("@electron/remote/main").initialize();
  // 创建主窗口
  createWindow();
});

/**
 * 'window-all-closed' 事件：所有窗口关闭
 * 
 * Windows/Linux：退出应用
 * macOS：保持应用运行（符合 macOS 习惯）
 * 
 * macOS 的应用通常在关闭所有窗口后仍然保持运行，
 * 点击 Dock 图标可以重新打开窗口
 */
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/**
 * 'second-instance' 事件：检测到第二个实例启动
 * 
 * 因为启用了单实例锁，当用户尝试再次启动应用时：
 * 1. 新实例会被阻止
 * 2. 已运行的实例收到此事件
 * 3. 创建新窗口或聚焦现有窗口
 */
app.on("second-instance", () => {
  createWindow();
});

/**
 * 'activate' 事件：应用被激活（macOS 特有）
 * 
 * 触发场景：
 * - 点击 Dock 图标
 * - 点击通知
 * - 从其他应用切换回来
 * 
 * 行为：
 * - 如果有窗口：聚焦第一个窗口
 * - 如果没有窗口：创建新窗口
 */
app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// ============================================
// 第五部分：IPC 通信处理器
// ============================================

/**
 * IPC 处理器：打开窗口/项目
 * 
 * 渲染进程调用：ipcRenderer.invoke("open-win", projectPath)
 * 
 * 三种情况：
 * 1. 项目已在某个窗口打开：聚焦该窗口
 * 2. 当前窗口未打开项目：在当前窗口打开项目
 * 3. 其他情况：创建新窗口
 * 
 * @param e IPC 事件对象
 * @param arg 项目路径（.b3-workspace 文件）
 * 
 * 工作流程：
 * ┌─────────────┐
 * │ 渲染进程请求 │
 * └──────┬──────┘
 *        │
 *        ├─ 1. 项目已打开？ ──> 聚焦窗口
 *        │
 *        ├─ 2. 当前窗口空闲？ ──> 当前窗口打开
 *        │
 *        └─ 3. 其他 ──> 创建新窗口
 */
ipcMain.handle("open-win", (e, arg) => {
  if (arg) {
    // 情况1：检查项目是否已在某个窗口打开
    let workspace = windows.find((v) => v.projectPath === arg);
    if (workspace) {
      workspace.window.focus();  // 聚焦已打开的窗口
      return;
    }

    // 情况2：在当前窗口打开项目（如果当前窗口未打开项目）
    workspace = windows.find((v) => v.window.webContents.id === e.sender.id);
    if (workspace && !workspace.projectPath) {
      workspace.projectPath = arg;
      // 通知渲染进程打开项目
      workspace.window.webContents.send("open-project", arg);
      return;
    }
  }

  // 情况3：创建新窗口
  createWindow(arg);
});

/**
 * IPC 处理器：窗口准备就绪
 * 
 * 渲染进程调用：ipcRenderer.invoke("ready-to-show")
 * 
 * 当 React 应用初始化完成后，渲染进程会调用此方法
 * 如果窗口已关联项目路径，则通知渲染进程打开该项目
 * 
 * @param e IPC 事件对象
 * 
 * 使用场景：
 * - 命令行启动时指定项目：behavior3editor project.b3-workspace
 * - 从文件管理器双击项目文件打开
 */
ipcMain.handle("ready-to-show", (e) => {
  // 根据 webContents ID 查找对应的工作区
  const workspace = windows.find((v) => v.window.webContents.id === e.sender.id);
  if (workspace && workspace.projectPath) {
    // 通知渲染进程打开项目
    workspace.window.webContents.send("open-project", workspace.projectPath);
  }
});

/**
 * IPC 处理器：删除文件到回收站
 * 
 * 渲染进程调用：ipcRenderer.invoke("trash-item", filePath)
 * 
 * 使用系统回收站删除文件（可恢复）
 * Windows: 回收站
 * macOS: 废纸篓
 * Linux: 回收站
 * 
 * @param _ IPC 事件对象（未使用）
 * @param arg 文件路径
 */
ipcMain.handle("trash-item", (_, arg) => {
  // 统一路径分隔符（POSIX / -> 系统特定）
  arg = arg.replace(/\//g, path.sep);
  // 移动到回收站
  shell.trashItem(arg).catch((e) => console.error(e));
});

/**
 * IPC 处理器：在文件管理器中显示文件
 * 
 * 渲染进程调用：ipcRenderer.invoke("show-item-in-folder", filePath)
 * 
 * 打开文件管理器并高亮显示指定文件
 * Windows: 资源管理器
 * macOS: Finder
 * Linux: 文件管理器（取决于桌面环境）
 * 
 * @param _ IPC 事件对象（未使用）
 * @param arg 文件路径
 */
ipcMain.handle("show-item-in-folder", (_, arg) => {
  // 统一路径分隔符
  arg = arg.replace(/\//g, path.sep);
  // 在文件管理器中显示
  shell.showItemInFolder(arg);
});
