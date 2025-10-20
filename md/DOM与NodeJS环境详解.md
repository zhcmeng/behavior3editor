# DOM 环境 vs Node.js 环境详解

## 📋 目录

1. [什么是运行环境](#什么是运行环境)
2. [DOM 环境详解](#dom-环境详解)
3. [Node.js 环境详解](#nodejs-环境详解)
4. [两者对比](#两者对比)
5. [Electron 中的特殊情况](#electron-中的特殊情况)
6. [实战示例](#实战示例)

---

## 🌍 什么是运行环境

**运行环境（Runtime Environment）** 是代码执行时所依赖的基础设施和 API 集合。

想象一下：
- JavaScript 代码本身只是文本
- 需要有"解释器"来执行这些代码
- 不同的解释器提供不同的功能（API）

```
JavaScript 代码
      ↓
  运行环境（提供 API）
      ↓
   实际功能
```

---

## 🖼️ DOM 环境详解

### 什么是 DOM 环境？

**DOM 环境 = 浏览器环境**，运行在浏览器中，由浏览器提供 API。

```
┌─────────────────────────────────────────────┐
│          浏览器（Chrome/Firefox/Safari）      │
├─────────────────────────────────────────────┤
│                                             │
│  JavaScript 引擎（V8/SpiderMonkey）          │
│  ├─ 执行 JavaScript 代码                     │
│  └─ 提供 ECMAScript 标准 API                │
│                                             │
│  DOM API（浏览器独有）                       │
│  ├─ document                                │
│  ├─ window                                  │
│  ├─ localStorage                            │
│  ├─ fetch                                   │
│  └─ ...                                     │
│                                             │
│  Web APIs                                   │
│  ├─ setTimeout/setInterval                  │
│  ├─ XMLHttpRequest                          │
│  ├─ Canvas API                              │
│  └─ ...                                     │
│                                             │
└─────────────────────────────────────────────┘
```

### DOM 环境的核心特点

#### 1. 有 `document` 对象

```javascript
// ✅ DOM 环境可用
document.getElementById('app');           // 获取 DOM 元素
document.createElement('div');            // 创建元素
document.body.appendChild(element);       // 操作 DOM
document.querySelector('.my-class');      // CSS 选择器
```

#### 2. 有 `window` 对象（全局对象）

```javascript
// ✅ DOM 环境可用
window.location.href;                     // 当前 URL
window.alert('Hello');                    // 弹窗
window.innerWidth;                        // 窗口宽度
window.localStorage.setItem('key', 'value'); // 本地存储
```

#### 3. 网络请求 API

```javascript
// ✅ DOM 环境可用
// 方式 1：现代 fetch API
fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data));

// 方式 2：传统 XMLHttpRequest
const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://api.example.com/data');
xhr.send();
```

#### 4. 浏览器特定 API

```javascript
// ✅ DOM 环境可用
navigator.userAgent;                      // 浏览器信息
navigator.geolocation.getCurrentPosition(); // 地理位置
history.pushState();                      // 历史记录
console.log('调试信息');                   // 控制台输出
```

#### 5. **没有文件系统访问**

```javascript
// ❌ DOM 环境不可用（安全限制）
const fs = require('fs');                 // 报错：require is not defined
fs.readFileSync('/path/to/file');         // 无法访问本地文件
```

### DOM 环境的安全沙盒

浏览器运行在**沙盒（Sandbox）**中，限制了对系统资源的访问：

```
┌────────────────────────────────────┐
│       浏览器安全沙盒                │
├────────────────────────────────────┤
│ ✅ 可以做的：                       │
│  - 操作网页 DOM                    │
│  - 发送网络请求                     │
│  - 使用 localStorage               │
│  - 访问相机/麦克风（需用户授权）     │
│                                    │
│ ❌ 不能做的：                       │
│  - 读写本地文件系统                 │
│  - 执行系统命令                     │
│  - 访问其他网站的数据（跨域限制）    │
│  - 关闭其他窗口                     │
└────────────────────────────────────┘
```

**为什么要限制？**
- 防止恶意网站删除你的文件
- 防止窃取其他网站的 Cookie
- 防止执行病毒程序

---

## 🟢 Node.js 环境详解

### 什么是 Node.js 环境？

**Node.js = JavaScript 运行在服务器端**，不是浏览器，没有 DOM。

```
┌─────────────────────────────────────────────┐
│            Node.js 运行时                    │
├─────────────────────────────────────────────┤
│                                             │
│  JavaScript 引擎（V8）                       │
│  ├─ 执行 JavaScript 代码                     │
│  └─ 提供 ECMAScript 标准 API                │
│                                             │
│  Node.js 核心模块                           │
│  ├─ fs（文件系统）                          │
│  ├─ path（路径处理）                        │
│  ├─ http/https（网络服务器）                │
│  ├─ os（操作系统信息）                      │
│  ├─ child_process（子进程）                 │
│  ├─ crypto（加密）                          │
│  └─ ...                                     │
│                                             │
│  全局对象（global）                         │
│  ├─ process（进程信息）                     │
│  ├─ Buffer（二进制数据）                    │
│  ├─ __dirname/__filename                   │
│  └─ require()                               │
│                                             │
└─────────────────────────────────────────────┘
```

### Node.js 环境的核心特点

#### 1. 有文件系统访问（`fs` 模块）

```javascript
// ✅ Node.js 环境可用
const fs = require('fs');

// 读取文件
const content = fs.readFileSync('/path/to/file.txt', 'utf-8');
console.log(content);

// 写入文件
fs.writeFileSync('/path/to/output.txt', 'Hello World');

// 删除文件
fs.unlinkSync('/path/to/file.txt');

// 创建目录
fs.mkdirSync('/path/to/new-dir');

// 列出目录内容
const files = fs.readdirSync('/path/to/dir');
```

#### 2. 有进程管理（`process` 对象）

```javascript
// ✅ Node.js 环境可用
console.log(process.version);         // Node.js 版本
console.log(process.platform);        // 操作系统：'win32', 'darwin', 'linux'
console.log(process.argv);            // 命令行参数
console.log(process.env);             // 环境变量
process.exit(0);                      // 退出进程
```

#### 3. 可以执行系统命令（`child_process`）

```javascript
// ✅ Node.js 环境可用
const { exec } = require('child_process');

// 执行系统命令
exec('ls -la', (error, stdout, stderr) => {
  console.log(stdout);
});

// Windows 示例
exec('dir', (error, stdout) => {
  console.log(stdout);
});
```

#### 4. 有路径处理（`path` 模块）

```javascript
// ✅ Node.js 环境可用
const path = require('path');

path.join('/user', 'documents', 'file.txt');    // '/user/documents/file.txt'
path.resolve('file.txt');                       // 绝对路径
path.basename('/user/documents/file.txt');      // 'file.txt'
path.dirname('/user/documents/file.txt');       // '/user/documents'
path.extname('file.txt');                       // '.txt'
```

#### 5. 可以创建 HTTP 服务器

```javascript
// ✅ Node.js 环境可用
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
```

#### 6. **没有 DOM**

```javascript
// ❌ Node.js 环境不可用
document.getElementById('app');       // 报错：document is not defined
window.alert('Hello');                // 报错：window is not defined
localStorage.setItem('key', 'value'); // 报错：localStorage is not defined
```

### Node.js 的权限

Node.js **没有沙盒限制**，拥有完整的系统权限：

```
┌────────────────────────────────────┐
│         Node.js 权限                │
├────────────────────────────────────┤
│ ✅ 可以做的：                       │
│  - 读写任何文件                     │
│  - 执行系统命令                     │
│  - 创建网络服务器                   │
│  - 访问数据库                       │
│  - 安装和使用 npm 包                │
│  - 创建子进程                       │
│                                    │
│ ⚠️ 风险：                           │
│  - 恶意代码可以删除文件              │
│  - 可以窃取敏感信息                 │
│  - 可以执行病毒程序                 │
└────────────────────────────────────┘
```

---

## ⚖️ 两者对比

### 核心差异表

| 特性 | DOM 环境（浏览器） | Node.js 环境 |
|-----|-------------------|--------------|
| **运行位置** | 浏览器中 | 服务器/本地 |
| **全局对象** | `window` | `global` |
| **DOM 操作** | ✅ `document`, `window` | ❌ 无 |
| **文件系统** | ❌ 无（安全限制） | ✅ `fs` 模块 |
| **网络请求** | ✅ `fetch`, `XMLHttpRequest` | ✅ `http`, `https` |
| **模块系统** | ES Modules (`import/export`) | CommonJS (`require`) + ES Modules |
| **进程控制** | ❌ 无 | ✅ `process` |
| **系统命令** | ❌ 无 | ✅ `child_process` |
| **路径处理** | ❌ 无原生支持 | ✅ `path` 模块 |
| **安全性** | 沙盒限制 | 完整权限 |
| **用途** | 网页交互 | 服务器、工具、脚本 |

### API 可用性对比

#### DOM 环境独有的 API

```javascript
// ✅ 只在浏览器中可用
document.getElementById('app')
window.location.href
localStorage.setItem('key', 'value')
navigator.userAgent
history.pushState()
fetch('https://api.example.com')
console.log() // 输出到浏览器控制台
alert('message')
```

#### Node.js 环境独有的 API

```javascript
// ✅ 只在 Node.js 中可用
require('fs')
require('path')
require('http')
process.argv
process.env
__dirname
__filename
Buffer.from('data')
global.something
```

#### 两者共有的 API（ECMAScript 标准）

```javascript
// ✅ 两个环境都可用
console.log('Hello')
setTimeout(() => {}, 1000)
setInterval(() => {}, 1000)
Promise.resolve()
async/await
Array, Object, String, Number, Date
JSON.parse(), JSON.stringify()
Math.random()
```

---

## 🎯 Electron 中的特殊情况

Electron 将两个环境结合在一起！

### Electron 的三个进程/环境

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron 应用                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐                                       │
│  │   主进程 (Main)   │  ← 纯 Node.js 环境                   │
│  │  - 完整的 Node.js │                                      │
│  │  - 无 DOM         │                                      │
│  │  - 窗口管理       │                                      │
│  └──────────────────┘                                       │
│           ↕ IPC                                             │
│  ┌──────────────────┐                                       │
│  │  预加载 (Preload) │  ← 特殊：Node.js + DOM              │
│  │  - 有 Node.js     │                                      │
│  │  - 有 DOM         │                                      │
│  │  - 桥梁层         │                                      │
│  └──────────────────┘                                       │
│           ↓                                                  │
│  ┌──────────────────┐                                       │
│  │ 渲染进程 (Render) │  ← 可配置                            │
│  │  - Chromium 浏览器│                                      │
│  │  - 有 DOM         │                                      │
│  │  - 可选 Node.js   │  (nodeIntegration)                 │
│  └──────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 主进程（Main Process）

**环境**：纯 Node.js

```javascript
// electron/main/index.ts

// ✅ 可用：Node.js API
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

// ✅ 可用：Electron API
const win = new BrowserWindow({
  width: 800,
  height: 600
});

// ❌ 不可用：DOM API
document.getElementById('app');  // 报错：document is not defined
window.alert('Hello');           // 报错：window is not defined
```

### 预加载脚本（Preload Script）

**环境**：Node.js + DOM（特殊环境）

```javascript
// electron/preload/index.ts

// ✅ 可用：Node.js API
const fs = require('fs');
const path = require('path');

// ✅ 可用：DOM API
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');
});

// ✅ 可用：同时访问两者
const content = fs.readFileSync('file.txt', 'utf-8');
document.getElementById('app').textContent = content;
```

### 渲染进程（Renderer Process）

**环境**：取决于配置

#### 配置 1：`nodeIntegration: false`（推荐，安全）

```javascript
// ✅ 可用：DOM API
document.getElementById('app');

// ❌ 不可用：Node.js API
const fs = require('fs');  // 报错：require is not defined
```

#### 配置 2：`nodeIntegration: true`（本项目使用，不安全）

```javascript
// ✅ 可用：DOM API
document.getElementById('app');

// ✅ 可用：Node.js API
const fs = require('fs');
const path = require('path');

// ✅ 可用：同时访问两者（像预加载脚本）
const content = fs.readFileSync('file.txt', 'utf-8');
document.getElementById('app').textContent = content;
```

### 本项目的配置

```typescript
// electron/main/index.ts
webPreferences: {
  nodeIntegration: true,     // 渲染进程可用 Node.js
  contextIsolation: false,   // 不隔离上下文
}
```

**结果**：渲染进程拥有 DOM + Node.js 双重能力

```javascript
// src/contexts/workspace-context.ts

// ✅ 使用 Node.js API
import * as fs from 'fs';
const content = fs.readFileSync(path, 'utf-8');

// ✅ 使用 DOM API（在 React 组件中）
document.getElementById('root');

// ✅ 使用 Electron API
import { dialog } from '@electron/remote';
const result = await dialog.showOpenDialog({ ... });
```

---

## 💡 实战示例

### 示例 1：读取文件并显示在页面上

#### 方式 1：纯浏览器（无法直接读取本地文件）

```html
<!-- 浏览器环境 -->
<!DOCTYPE html>
<html>
<body>
  <!-- 只能通过文件选择器 -->
  <input type="file" id="fileInput">
  <div id="content"></div>
  
  <script>
    document.getElementById('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        document.getElementById('content').textContent = e.target.result;
      };
      
      reader.readAsText(file);
    });
  </script>
</body>
</html>
```

#### 方式 2：Node.js（无法显示在网页上）

```javascript
// Node.js 环境
const fs = require('fs');

// 读取文件
const content = fs.readFileSync('/path/to/file.txt', 'utf-8');

// 只能输出到控制台，无法显示在网页上
console.log(content);

// ❌ 无法这样做
document.getElementById('content').textContent = content;  // 报错
```

#### 方式 3：Electron（结合两者优势）

```javascript
// Electron 渲染进程（nodeIntegration: true）
import * as fs from 'fs';

// ✅ 使用 Node.js 读取文件
const content = fs.readFileSync('/path/to/file.txt', 'utf-8');

// ✅ 使用 DOM 显示在网页上
document.getElementById('content').textContent = content;
```

### 示例 2：检查环境

如何判断代码运行在哪个环境？

```javascript
/**
 * 检查运行环境
 */
function detectEnvironment() {
  // 检查 DOM 环境
  const hasDom = typeof document !== 'undefined';
  
  // 检查 Node.js 环境
  const hasNodejs = typeof process !== 'undefined' && 
                    process.versions && 
                    process.versions.node;
  
  // 检查 Electron 环境
  const isElectron = typeof process !== 'undefined' && 
                     process.versions && 
                     process.versions.electron;
  
  if (isElectron) {
    console.log('运行在 Electron 中');
    if (hasDom && hasNodejs) {
      console.log('渲染进程（有 DOM + Node.js）');
    } else if (hasNodejs) {
      console.log('主进程（纯 Node.js）');
    }
  } else if (hasDom) {
    console.log('运行在浏览器中（DOM 环境）');
  } else if (hasNodejs) {
    console.log('运行在 Node.js 中');
  }
}

detectEnvironment();
```

### 示例 3：跨环境的文件操作

#### 浏览器环境

```javascript
// 只能通过用户交互选择文件
async function readFileInBrowser() {
  // 创建文件选择器
  const input = document.createElement('input');
  input.type = 'file';
  
  return new Promise((resolve) => {
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  });
}
```

#### Node.js 环境

```javascript
// 可以直接访问任何文件
function readFileInNodejs(filePath) {
  const fs = require('fs');
  return fs.readFileSync(filePath, 'utf-8');
}
```

#### Electron 环境（最佳）

```javascript
// 结合对话框和文件系统
import { dialog } from '@electron/remote';
import * as fs from 'fs';

async function readFileInElectron() {
  // 1. 使用 Electron 对话框选择文件
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });
  
  if (result.canceled) return null;
  
  // 2. 使用 Node.js 读取文件
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 3. 使用 DOM 显示内容
  document.getElementById('content').textContent = content;
  
  return content;
}
```

---

## 📚 总结

### 关键要点

1. **DOM 环境**（浏览器）：
   - 有 `document`, `window`
   - 没有文件系统访问
   - 有安全沙盒限制
   - 用于网页交互

2. **Node.js 环境**：
   - 没有 `document`, `window`
   - 有完整的文件系统访问
   - 没有安全限制
   - 用于服务器和工具

3. **Electron 的魔法**：
   - 主进程：纯 Node.js
   - 预加载脚本：Node.js + DOM
   - 渲染进程：可配置（可以同时拥有两者）

### 类比理解

```
DOM 环境     = 在水族馆看鱼
               - 安全（隔着玻璃）
               - 功能受限（只能看）
               - 用户友好

Node.js 环境 = 在海里游泳
               - 自由（无限制）
               - 危险（可能被咬）
               - 功能强大

Electron     = 穿着潜水服在海里
               - 既安全又自由
               - 结合两者优势
               - 最适合桌面应用
```

### 开发建议

1. **网页开发**：只用 DOM 环境
2. **服务器开发**：只用 Node.js 环境
3. **桌面应用**：用 Electron（两者结合）
4. **安全性**：生产环境启用 `contextIsolation`
5. **调试**：用 `console.log` 检查可用 API

---

## 🔗 相关资源

- [MDN Web API 文档](https://developer.mozilla.org/en-US/docs/Web/API)
- [Node.js 官方文档](https://nodejs.org/docs)
- [Electron 官方文档](https://www.electronjs.org/docs)
- [JavaScript 运行时对比](https://www.youtube.com/watch?v=...)

现在你应该能清楚地理解 DOM 环境和 Node.js 环境的区别了！🎉

