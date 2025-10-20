# Vite 详解

## 📋 什么是 Vite？

**Vite**（法语 "快速" 的意思，读音：/vit/，类似 "veet"）是一个**现代化的前端构建工具**。

**核心作用：**
1. 开发服务器（Development Server）
2. 代码构建打包（Build Tool）

**简单理解：**
```
Vite = 开发时的"服务器" + 构建时的"打包工具"
```

---

## 🎯 Vite 的两大功能

### 1. 开发服务器（Dev Server）

**启动开发模式时：**
```bash
npm run dev
# 实际执行：vite
```

**Vite 做什么：**
```
1. 启动本地服务器（http://localhost:7777）
2. 监听文件变化
3. 文件改动时：
   ├─ 编译改动的文件（TypeScript → JavaScript）
   ├─ 自动刷新浏览器（热更新）
   └─ 速度极快（只编译改动的文件）
```

**开发流程：**
```
你修改 workspace.tsx
  ↓
保存文件
  ↓
Vite 检测到变化
  ↓
编译 workspace.tsx（TSX → JS）
  ↓
浏览器自动刷新
  ↓
你立即看到修改效果（<1秒）
```

### 2. 构建打包（Build）

**构建生产版本时：**
```bash
npm run build
# 实际执行：tsc && vite build && electron-builder
```

**Vite 做什么：**
```
1. 编译所有 TypeScript 文件
2. 打包所有依赖
3. 压缩代码
4. 优化资源
5. 生成最终的文件
   ├─ dist/           (前端代码)
   └─ dist-electron/  (Electron 代码)
```

---

## 📊 Vite vs 传统工具

### 对比 Webpack（旧一代工具）

| 特性 | Webpack（传统） | Vite（现代） |
|-----|---------------|------------|
| **启动速度** | 慢（30-60秒） | 快（<5秒） |
| **热更新速度** | 慢（3-5秒） | 快（<1秒） |
| **配置复杂度** | 复杂 | 简单 |
| **开发体验** | 一般 | 优秀 ⭐ |
| **生态** | 成熟 | 快速增长 |

### 为什么 Vite 更快？

**Webpack（旧方式）：**
```
开发模式启动：
1. 扫描所有文件
2. 编译所有文件（即使没用到）
3. 打包成一个大文件
4. 启动服务器
→ 需要 30-60 秒

文件修改：
1. 重新编译相关文件
2. 重新打包
3. 刷新浏览器
→ 需要 3-5 秒
```

**Vite（新方式）：**
```
开发模式启动：
1. 启动服务器
2. 不编译（使用浏览器原生 ES Module）
3. 按需编译（只编译访问的文件）
→ 需要 <5 秒

文件修改：
1. 只编译改动的文件
2. 热替换（不刷新整个页面）
→ 需要 <1 秒
```

**关键技术：**
- **ESM（ES Modules）**: 浏览器原生支持的模块系统
- **esbuild**: 超快的编译器（Go 语言编写）
- **按需编译**: 只编译需要的文件

---

## 🔧 在 Behavior3 Editor 中的使用

### 1. 配置文件

**文件位置：** `vite.config.ts`

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  // 路径别名
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),  // @ 代表 src 目录
    },
  },
  
  // 构建配置
  build: {
    sourcemap: true,  // 生成 source map（调试用）
  },
  
  // 插件
  plugins: [
    react(),           // React 支持（编译 TSX）
    electron({         // Electron 支持
      main: {
        entry: "electron/main/index.ts",  // 主进程入口
        outDir: "dist-electron/main",
      },
      preload: {
        input: "electron/preload/index.ts",  // 预加载脚本
        outDir: "dist-electron/preload",
      },
    }),
  ],
});
```

**配置说明：**
- `@vitejs/plugin-react`: 支持 React 和 TSX
- `vite-plugin-electron`: 支持 Electron
- `alias`: 路径简写（`@/components` = `src/components`）

### 2. 项目脚本

**文件位置：** `package.json:15-22`

```json
{
  "scripts": {
    "dev": "vite",                              // 开发模式
    "build": "tsc && vite build && electron-builder",  // 构建
    "preview": "vite preview",                  // 预览构建结果
    "pretest": "vite build --mode=test",        // 测试构建
    "test": "vitest run"                        // 运行测试
  }
}
```

**脚本说明：**

#### dev（开发模式）
```bash
npm run dev
# ↓
vite
# ↓
启动开发服务器
  ├─ 监听文件变化
  ├─ 编译 TSX → JavaScript
  ├─ 启动 Electron 应用
  └─ 热更新（修改代码自动刷新）
```

#### build（构建生产版本）
```bash
npm run build
# ↓
tsc && vite build && electron-builder
# ↓
1. tsc: TypeScript 类型检查
2. vite build: 编译和打包代码
3. electron-builder: 打包成安装包
```

**构建流程：**
```
TypeScript 源码（src/）
  ↓ tsc（类型检查）
检查通过
  ↓ vite build（编译打包）
编译后的代码（dist/、dist-electron/）
  ↓ electron-builder（打包应用）
安装包（release/behavior3editor_1.8.5.exe）
```

#### preview（预览）
```bash
npm run preview
# ↓
vite preview
# ↓
启动服务器，预览构建后的代码
```

### 3. Vite 依赖

**文件位置：** `package.json:50-75`

```json
{
  "devDependencies": {
    "vite": "^6.3.5",                          // Vite 核心
    "@vitejs/plugin-react": "^4.3.4",          // React 插件
    "vite-plugin-electron": "^0.29.0",         // Electron 插件
    "vite-plugin-electron-renderer": "^0.14.6",
    "vitest": "^3.0.7"                         // 测试框架（基于Vite）
  }
}
```

---

## 🚀 Vite 的工作流程

### 开发模式流程

```
你执行：npm run dev
  ↓
启动 Vite 开发服务器
  ↓
Vite 做什么：
  ├─ 1. 读取 vite.config.ts 配置
  ├─ 2. 加载插件（React、Electron）
  ├─ 3. 启动 HTTP 服务器（端口 7777）
  ├─ 4. 编译入口文件（index.html、main.tsx）
  ├─ 5. 启动 Electron 应用
  └─ 6. 监听文件变化
  ↓
你打开编辑器（Electron 窗口）
  ↓
浏览器加载 index.html
  ↓
加载 main.tsx
  ↓
Vite 即时编译 main.tsx（TSX → JS）
  ↓
React 渲染界面
  ↓
你看到编辑器界面
  ↓
你修改 workspace.tsx
  ↓
Vite 检测到文件变化
  ├─ 编译 workspace.tsx
  └─ 热更新到浏览器（不刷新整个页面）
  ↓
界面立即更新（<1秒）
```

### 构建模式流程

```
你执行：npm run build
  ↓
第1步：tsc（TypeScript 类型检查）
  ├─ 检查所有 .ts/.tsx 文件
  ├─ 确保没有类型错误
  └─ 不生成文件（只检查）
  ↓
第2步：vite build（编译打包）
  ├─ 编译 src/ 下的所有文件
  │  ├─ TSX → JavaScript
  │  ├─ SCSS → CSS
  │  └─ 处理资源文件（图片、字体等）
  ├─ 打包成最少的文件
  │  ├─ dist/assets/index.js（前端代码）
  │  └─ dist/assets/index.css（样式）
  ├─ 压缩代码（移除空格、注释、混淆）
  └─ 优化性能
  ↓
第3步：electron-builder（打包应用）
  ├─ 将 dist/ 打包进 Electron
  ├─ 生成安装包
  └─ release/behavior3editor_1.8.5.exe
  ↓
完成！可以分发给用户
```

---

## 📁 Vite 处理的文件类型

### Vite 支持的文件

| 文件类型 | 处理方式 | 输出 |
|---------|---------|------|
| `.tsx/.jsx` | 编译（使用 React 插件） | JavaScript |
| `.ts` | 编译 | JavaScript |
| `.scss/.sass` | 编译 | CSS |
| `.css` | 处理（PostCSS） | CSS |
| `.svg/.png/.jpg` | 复制或内联 | 静态资源 |
| `.json` | 导入为 JavaScript 对象 | JavaScript |
| `.html` | 入口文件 | HTML |

### 在项目中

```
src/
├── main.tsx              → Vite 编译 → dist/assets/index.js
├── index.scss            → Vite 编译 → dist/assets/index.css
├── components/
│   ├── workspace.tsx     → Vite 编译 → 合并到 index.js
│   └── explorer.tsx      → Vite 编译 → 合并到 index.js
├── assets/
│   └── node.svg          → Vite 复制 → dist/assets/node.svg
└── vite-env.d.ts         → Vite 类型定义

electron/
├── main/index.ts         → Vite 编译 → dist-electron/main/index.js
└── preload/index.ts      → Vite 编译 → dist-electron/preload/index.mjs
```

---

## 🔍 Vite 的关键特性

### 1. 极速的冷启动

**原理：**
- 使用浏览器原生的 ES Modules
- 不需要打包整个应用
- 按需编译

```
传统工具（Webpack）启动：
  扫描 → 编译全部 → 打包 → 启动
  约 30-60 秒

Vite 启动：
  启动 → 按需编译
  约 2-5 秒
```

### 2. 闪电般的热更新（HMR）

**Hot Module Replacement（热模块替换）**

```
修改文件
  ↓
Vite 检测变化（<100ms）
  ↓
只编译改动的文件
  ↓
推送到浏览器
  ↓
浏览器替换模块（不刷新页面）
  ↓
界面立即更新（<1秒）

状态保留！
- 输入框的值不丢失
- 滚动位置不变
- 打开的文件仍然打开
```

### 3. 基于 ESM（ES Modules）

**浏览器原生模块系统：**
```html
<!-- index.html -->
<script type="module" src="/src/main.tsx"></script>
```

```typescript
// main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";

// 浏览器直接理解 import 语句
```

**优势：**
- 不需要打包（开发时）
- 浏览器按需加载
- 速度快

### 4. 代码分割和优化

**生产构建时：**
```
自动代码分割：
  ├─ vendor.js（第三方库：React、AntD）
  ├─ index.js（应用代码）
  └─ chunk-xxx.js（动态导入的代码）

优化：
  ├─ Tree Shaking（移除未使用的代码）
  ├─ 压缩混淆
  ├─ CSS 提取和压缩
  └─ 资源优化
```

---

## 💻 Vite 在开发中的体验

### 开发模式

```bash
# 1. 启动开发服务器
npm run dev

# Vite 输出：
#   VITE v6.3.5  ready in 1234 ms
#
#   ➜  Local:   http://localhost:7777/
#   ➜  Network: use --host to expose
#
#   ➜  press h + enter to show help
```

**体验：**
```
修改代码 → 保存 → 自动更新（<1秒）
```

**对比传统工具：**
```
Webpack: 修改代码 → 保存 → 等待编译（3-5秒）→ 刷新
Vite:    修改代码 → 保存 → 立即更新（<1秒）
```

### 构建模式

```bash
# 构建生产版本
npm run build

# Vite 输出：
# vite v6.3.5 building for production...
# ✓ 123 modules transformed.
# dist/index.html                   0.45 kB
# dist/assets/index-D7H2q2v7.js   123.45 kB │ gzip: 45.67 kB
# dist/assets/index-D_ASz5jf.css   12.34 kB │ gzip: 3.45 kB
# ✓ built in 5.67s
```

---

## 🛠️ Vite 配置详解

### vite.config.ts 结构

```typescript
export default defineConfig({
  // ========== 路径解析 ==========
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),  // @ = src/
    },
  },
  
  // ========== 构建配置 ==========
  build: {
    sourcemap: true,       // 生成 source map（调试）
    outDir: "dist",        // 输出目录
    minify: true,          // 压缩代码
    target: "esnext",      // 目标浏览器
  },
  
  // ========== 插件 ==========
  plugins: [
    react(),               // React/TSX 支持
    electron({             // Electron 支持
      main: {
        entry: "electron/main/index.ts",
        outDir: "dist-electron/main",
      },
      preload: {
        input: "electron/preload/index.ts",
        outDir: "dist-electron/preload",
      },
    }),
  ],
  
  // ========== 开发服务器 ==========
  server: {
    port: 7777,            // 端口号
    host: "localhost",     // 主机
    open: false,           // 不自动打开浏览器
  },
});
```

### 插件系统

#### 1. @vitejs/plugin-react

**作用：** 支持 React 和 TSX

```typescript
import react from "@vitejs/plugin-react";

plugins: [
  react()  // 自动处理 .tsx 和 .jsx 文件
]
```

**功能：**
- 编译 TSX/JSX → JavaScript
- 支持 React Fast Refresh（热更新）
- 支持 React 的开发工具

#### 2. vite-plugin-electron

**作用：** 支持 Electron

```typescript
import electron from "vite-plugin-electron/simple";

plugins: [
  electron({
    main: {
      entry: "electron/main/index.ts",   // 主进程
    },
    preload: {
      input: "electron/preload/index.ts", // 预加载脚本
    },
  })
]
```

**功能：**
- 编译 Electron 主进程代码
- 编译预加载脚本
- 开发时自动重启 Electron
- 支持 Node.js API

---

## 📊 文件处理流程

### 开发模式（npm run dev）

```
index.html（入口）
  ↓ 引用
src/main.tsx
  ↓ Vite 实时编译（按需）
main.tsx → main.js（内存中，不写入磁盘）
  ↓ 浏览器加载
React 渲染界面
  ↓ 你修改 workspace.tsx
Vite 检测变化
  ↓ 只编译 workspace.tsx
workspace.tsx → workspace.js（内存中）
  ↓ 热替换
浏览器更新（不刷新）
  ↓ 界面立即更新
```

### 构建模式（npm run build）

```
src/ 所有源文件
  ↓ Vite 编译和打包
dist/
  ├── index.html
  ├── assets/
  │   ├── index-D7H2q2v7.js（所有 JS，已压缩）
  │   └── index-D_ASz5jf.css（所有 CSS，已压缩）
  └── icons/（静态资源）

electron/ Electron 代码
  ↓ Vite 编译
dist-electron/
  ├── main/index.js（主进程）
  └── preload/index.mjs（预加载脚本）
```

---

## 🎯 Vite 的优势

### 1. 开发体验优秀

```
启动快   → 2-5 秒（vs Webpack 30-60秒）
更新快   → <1 秒（vs Webpack 3-5秒）
配置简单 → 开箱即用
```

### 2. 生态丰富

**支持的框架：**
- ✅ React
- ✅ Vue
- ✅ Svelte
- ✅ Solid
- ✅ Preact
- ✅ Lit

**支持的功能：**
- ✅ TypeScript
- ✅ CSS 预处理器（SCSS、Less、Stylus）
- ✅ PostCSS
- ✅ JSON 导入
- ✅ WebAssembly
- ✅ Web Workers

### 3. 性能优秀

**构建性能：**
- 使用 esbuild（Go 编写，比 JavaScript 快 10-100 倍）
- 并行处理
- 增量编译

**运行时性能：**
- 自动代码分割
- 按需加载
- Tree Shaking
- 压缩优化

---

## 🔧 常用 Vite 命令

### 开发

```bash
# 启动开发服务器
npm run dev
# 或
vite

# 指定端口
vite --port 8080

# 开放网络访问
vite --host
```

### 构建

```bash
# 构建生产版本
npm run build
# 或
vite build

# 指定模式
vite build --mode production
vite build --mode test

# 查看构建报告
vite build --report
```

### 预览

```bash
# 预览构建结果
npm run preview
# 或
vite preview
```

---

## 📝 Vite 相关文件

### 配置文件
```
vite.config.ts              Vite 主配置文件
tsconfig.json               TypeScript 配置
tsconfig.node.json          Node.js 环境的 TS 配置
postcss.config.cjs          PostCSS 配置（CSS 处理）
tailwind.config.js          Tailwind CSS 配置
```

### 输出目录
```
dist/                       前端构建输出
  ├── index.html
  ├── assets/
  │   ├── index-xxx.js
  │   └── index-xxx.css
  └── icons/

dist-electron/              Electron 构建输出
  ├── main/
  │   └── index.js
  └── preload/
      └── index.mjs
```

### 源文件
```
src/                        前端源码（Vite 编译）
  ├── main.tsx              入口文件
  ├── components/           组件
  └── ...

electron/                   Electron 源码（Vite 编译）
  ├── main/                 主进程
  └── preload/              预加载脚本

index.html                  HTML 入口
```

---

## 🎓 总结

### Vite 是什么？

**简单答案：**
```
Vite = 前端开发和构建工具
```

**详细答案：**
1. **开发时**：提供超快的开发服务器
2. **构建时**：提供高效的打包工具
3. **特点**：快速、现代、简单

### Vite 的作用

**在 Behavior3 Editor 中：**

| 阶段 | Vite 的作用 |
|-----|-----------|
| **开发时** | 启动服务器、编译 TSX、热更新 |
| **构建时** | 编译打包、优化代码、生成最终文件 |

### Vite vs 其他工具

```
Vite      = 新一代（快速、现代）⭐
Webpack   = 上一代（成熟、复杂）
Parcel    = 零配置（简单、功能少）
Rollup    = 库打包（专注打包）
esbuild   = 超快编译器（Vite 底层使用）
```

### 为什么选择 Vite？

1. ✅ **极速的开发体验**（启动快、更新快）
2. ✅ **简单的配置**（开箱即用）
3. ✅ **现代化**（基于 ESM）
4. ✅ **支持 Electron**（vite-plugin-electron）
5. ✅ **支持 React**（@vitejs/plugin-react）
6. ✅ **活跃的社区**（越来越流行）

### 在技术栈中的位置

```
┌─────────────────────────────────┐
│  Behavior3 Editor (应用)         │
│  ┌───────────────────────────┐  │
│  │  React (UI 框架)          │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  TypeScript (语言)  │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
          ↓ 编译和打包
┌─────────────────────────────────┐
│       Vite (构建工具)            │  ← 开发服务器 + 构建打包
│  ┌───────────────────────────┐  │
│  │  esbuild (编译器)         │  │  ← Vite 底层使用
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 记住

- ✅ Vite 是**构建工具**，不是框架
- ✅ 开发时提供服务器和热更新
- ✅ 构建时编译和打包代码
- ✅ 速度快是最大优势
- ✅ 本项目使用 Vite 6.3.5

---

## 📚 扩展资源

### 官方文档
- 中文：https://cn.vitejs.dev/
- 英文：https://vitejs.dev/

### 学习重点
- 为什么 Vite 这么快？
- 配置文件 vite.config.ts
- 插件系统

### 不需要深入
- ❌ Rollup 原理
- ❌ esbuild 实现
- ❌ ESM 规范细节

### 相关工具
- esbuild: https://esbuild.github.io/
- Rollup: https://rollupjs.org/
- Webpack: https://webpack.js.org/

---

## 🎉 结论

**Vite 让开发更快更爽！**

在 Behavior3 Editor 中：
- 开发时：快速启动、即时更新
- 构建时：高效打包、优化输出

您不需要深入理解 Vite 的原理，只需要知道：
- `npm run dev` → Vite 启动开发服务器
- `npm run build` → Vite 构建生产代码
- 修改代码 → Vite 自动更新界面

就够了！

