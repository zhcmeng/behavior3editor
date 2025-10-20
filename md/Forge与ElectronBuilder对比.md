# Electron Forge vs electron-builder 对比详解

## 📋 目录

1. [快速对比](#快速对比)
2. [Electron Forge 详解](#electron-forge-详解)
3. [electron-builder 详解](#electron-builder-详解)
4. [详细对比](#详细对比)
5. [选择建议](#选择建议)
6. [迁移指南](#迁移指南)

---

## ⚡ 快速对比

### 核心差异表

| 特性 | Electron Forge | electron-builder |
|-----|---------------|------------------|
| **官方支持** | ✅ Electron 官方工具 | ❌ 社区项目 |
| **设计理念** | 全栈开发工具链 | 专注打包和分发 |
| **学习曲线** | 较陡（插件系统） | 较平缓（配置驱动） |
| **配置方式** | JavaScript/TypeScript | JSON |
| **文档质量** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **社区规模** | 中等 | 非常大 |
| **打包速度** | 中等 | 快 |
| **自动更新** | 需要插件 | 内置支持 |
| **代码签名** | 需要配置 | 简单易用 |
| **多平台** | ✅ | ✅ |
| **热更新开发** | ✅ 内置 | ❌ 需配合其他工具 |
| **适合项目** | 新项目、需要完整工具链 | 现有项目、快速打包 |

---

## 🔨 Electron Forge 详解

### 什么是 Electron Forge？

**Electron Forge** 是 Electron 官方维护的**完整工具链**，不仅仅是打包工具。

```
┌─────────────────────────────────────────────────────────┐
│            Electron Forge 工具链                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  项目初始化                                              │
│  ├─ 脚手架模板                                          │
│  └─ 自动配置                                            │
│                                                         │
│  开发工具                                                │
│  ├─ 热更新（Hot Reload）                               │
│  ├─ 开发服务器                                          │
│  └─ 调试支持                                            │
│                                                         │
│  打包工具                                                │
│  ├─ Webpack 插件                                        │
│  ├─ Vite 插件                                          │
│  └─ Parcel 插件                                        │
│                                                         │
│  分发工具                                                │
│  ├─ 多平台打包                                          │
│  ├─ 安装器生成                                          │
│  └─ 发布到各平台                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 核心特点

#### 1. 官方支持

```bash
# Electron 团队官方维护
# 与 Electron 版本同步更新
# 第一时间支持新特性
```

#### 2. 完整的工具链

```bash
# 创建新项目
npm init electron-app@latest my-app -- --template=webpack-typescript

# 启动开发模式（自动热更新）
npm start

# 打包应用
npm run make

# 发布应用
npm run publish
```

#### 3. 插件系统

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {},
  
  // 打包插件：选择构建工具
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window'
            }
          ]
        }
      }
    }
  ],
  
  // 制作插件：生成安装包
  makers: [
    {
      name: '@electron-forge/maker-squirrel',  // Windows
      config: {}
    },
    {
      name: '@electron-forge/maker-dmg',       // macOS
      config: {}
    },
    {
      name: '@electron-forge/maker-deb',       // Linux (Debian)
      config: {}
    }
  ],
  
  // 发布插件：发布到平台
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'username',
          name: 'repo'
        }
      }
    }
  ]
};
```

### 项目结构

```
my-electron-app/
├── src/
│   ├── main.js              # 主进程
│   ├── preload.js           # 预加载脚本
│   ├── renderer.js          # 渲染进程
│   └── index.html           # HTML
├── forge.config.js          # Forge 配置
├── webpack.main.config.js   # Webpack 主进程配置
├── webpack.renderer.config.js # Webpack 渲染进程配置
└── package.json
```

### 优点 ✅

1. **官方支持**
   - Electron 团队维护
   - 与新版本同步
   - 官方文档和示例

2. **完整工具链**
   - 创建、开发、打包、发布一条龙
   - 开箱即用的热更新
   - 内置开发服务器

3. **灵活的构建工具**
   - 支持 Webpack
   - 支持 Vite（新）
   - 支持 Parcel
   - 可自定义

4. **模块化设计**
   - 插件式架构
   - 按需安装功能
   - 易于扩展

### 缺点 ❌

1. **学习曲线较陡**
   - 插件系统复杂
   - 配置选项多
   - 文档有时不够详细

2. **配置繁琐**
   - 需要配置多个文件
   - Webpack 配置复杂
   - 难以调试

3. **社区相对较小**
   - 示例和教程较少
   - 遇到问题不好找解决方案
   - 第三方插件少

4. **打包速度**
   - 相对较慢（尤其是 Webpack）
   - 增量构建支持一般

---

## 📦 electron-builder 详解

### 什么是 electron-builder？

**electron-builder** 是一个**专注于打包和分发**的社区工具，配置简单，功能强大。

```
┌─────────────────────────────────────────────────────────┐
│          electron-builder 专注领域                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  打包优化                                                │
│  ├─ ASAR 归档                                           │
│  ├─ 代码压缩                                            │
│  └─ 依赖优化                                            │
│                                                         │
│  多平台支持                                              │
│  ├─ Windows (NSIS, MSI, Squirrel)                     │
│  ├─ macOS (DMG, PKG, ZIP)                             │
│  └─ Linux (AppImage, deb, rpm, snap)                  │
│                                                         │
│  代码签名                                                │
│  ├─ Windows (证书)                                      │
│  ├─ macOS (Apple Developer)                           │
│  └─ 自动处理                                            │
│                                                         │
│  自动更新                                                │
│  ├─ electron-updater                                   │
│  ├─ 增量更新                                            │
│  └─ 多种发布源                                          │
│                                                         │
│  发布管理                                                │
│  ├─ GitHub Releases                                    │
│  ├─ S3                                                 │
│  └─ 自定义服务器                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 核心特点

#### 1. 配置驱动（本项目使用）

```json
// electron-builder.json
{
  "appId": "com.example.app",
  "productName": "My App",
  "asar": true,
  
  "directories": {
    "output": "release/${version}"
  },
  
  "files": [
    "dist-electron",
    "dist"
  ],
  
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  
  "mac": {
    "target": ["dmg"],
    "icon": "build/icon.icns"
  },
  
  "linux": {
    "target": ["AppImage"],
    "icon": "build/icon.png"
  }
}
```

#### 2. 简单易用

```bash
# 只需一个命令
electron-builder

# 指定平台
electron-builder --win
electron-builder --mac
electron-builder --linux

# 发布
electron-builder --publish always
```

#### 3. 内置自动更新

```typescript
// 在主进程中
import { autoUpdater } from "electron-updater";

// 检查更新
autoUpdater.checkForUpdatesAndNotify();

// 监听事件
autoUpdater.on('update-available', () => {
  console.log('有新版本可用');
});

autoUpdater.on('update-downloaded', () => {
  console.log('下载完成，准备安装');
  autoUpdater.quitAndInstall();
});
```

### 项目结构

```
my-electron-app/
├── dist-electron/           # Electron 代码（自己构建）
│   ├── main/
│   └── preload/
├── dist/                    # React/Vue 应用（自己构建）
│   ├── index.html
│   └── assets/
├── electron-builder.json    # 单一配置文件
└── package.json
```

### 优点 ✅

1. **简单易用**
   - 配置简洁（JSON）
   - 单一配置文件
   - 开箱即用

2. **功能强大**
   - 支持所有主流平台和格式
   - 内置自动更新
   - 代码签名简单
   - ASAR 归档

3. **社区活跃**
   - 使用广泛
   - 文档详细
   - 示例丰富
   - 问题容易找到解决方案

4. **打包速度快**
   - 优化良好
   - 增量构建
   - 并行处理

5. **灵活性高**
   - 不限定构建工具
   - 可配合任何前端框架
   - 支持自定义脚本

### 缺点 ❌

1. **不包含开发工具**
   - 需要自己配置热更新
   - 需要自己选择构建工具
   - 开发体验需要自己搭建

2. **非官方**
   - 社区维护
   - 可能滞后于 Electron 新特性
   - 依赖作者维护

3. **配置复杂度**
   - 高级功能配置复杂
   - 代码签名配置有门槛
   - 多平台配置需要调试

---

## 🔍 详细对比

### 1. 项目初始化

#### Electron Forge

```bash
# 使用官方脚手架
npm init electron-app@latest my-app

# 选择模板
npm init electron-app@latest my-app -- --template=webpack
npm init electron-app@latest my-app -- --template=webpack-typescript
npm init electron-app@latest my-app -- --template=vite
npm init electron-app@latest my-app -- --template=vite-typescript
```

**结果**：完整的项目结构，包括开发配置

#### electron-builder

```bash
# 需要手动创建项目
mkdir my-app
cd my-app
npm init -y
npm install electron --save-dev
npm install electron-builder --save-dev

# 需要手动配置构建工具（如 Vite、Webpack）
```

**结果**：需要自己搭建开发环境

---

### 2. 开发体验

#### Electron Forge

```bash
# 启动开发模式
npm start

# 自动功能：
# ✅ 热更新（代码修改自动刷新）
# ✅ 开发服务器
# ✅ Source map
# ✅ 错误提示
```

```javascript
// forge.config.js
plugins: [
  {
    name: '@electron-forge/plugin-webpack',
    config: {
      // Webpack 会自动处理热更新
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:",
      port: 3000,
      loggerPort: 9000
    }
  }
]
```

#### electron-builder

```bash
# 需要自己配置开发服务器
# 通常配合 Vite 或 Webpack Dev Server

# package.json
"scripts": {
  "dev": "vite",              # 启动 Vite 开发服务器
  "build": "vite build && electron-builder"
}
```

**本项目的做法**：
```typescript
// vite.config.ts
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main/index.ts",
        onstart(args) {
          args.startup();  // 启动 Electron
        }
      }
    })
  ]
});
```

---

### 3. 配置方式

#### Electron Forge（JavaScript 配置）

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    name: 'My App',
    icon: './assets/icon',
    appBundleId: 'com.example.app',
    // 可以使用 JavaScript 逻辑
    extraResource: process.platform === 'darwin' 
      ? ['./resources/mac']
      : ['./resources/win']
  },
  
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: require('./webpack.config.js')
    }
  ],
  
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Squirrel.Windows 配置
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        // macOS DMG 配置
        format: 'ULFO'
      }
    }
  ]
};
```

#### electron-builder（JSON 配置）

```json
// electron-builder.json
{
  "appId": "com.example.app",
  "productName": "My App",
  "directories": {
    "output": "release"
  },
  "files": ["dist"],
  
  "win": {
    "target": "nsis",
    "icon": "build/icon.ico"
  },
  
  "mac": {
    "target": "dmg",
    "icon": "build/icon.icns",
    "category": "public.app-category.developer-tools"
  },
  
  "linux": {
    "target": "AppImage",
    "icon": "build/icon.png"
  }
}
```

**对比**：
- Forge：JavaScript 配置，可编程，灵活但复杂
- Builder：JSON 配置，简洁但不能使用逻辑

---

### 4. 打包输出格式

#### Electron Forge

| 平台 | Maker 名称 | 输出格式 |
|-----|-----------|---------|
| Windows | `@electron-forge/maker-squirrel` | Squirrel.Windows |
| Windows | `@electron-forge/maker-wix` | MSI |
| Windows | `@electron-forge/maker-zip` | ZIP |
| macOS | `@electron-forge/maker-dmg` | DMG |
| macOS | `@electron-forge/maker-zip` | ZIP |
| macOS | `@electron-forge/maker-pkg` | PKG |
| Linux | `@electron-forge/maker-deb` | DEB |
| Linux | `@electron-forge/maker-rpm` | RPM |
| Linux | `@electron-forge/maker-appimage` | AppImage |

#### electron-builder（本项目使用）

| 平台 | Target | 输出格式 |
|-----|--------|---------|
| Windows | `nsis` | NSIS 安装器 |
| Windows | `portable` | 便携版 |
| Windows | `appx` | Windows Store |
| macOS | `dmg` | DMG 镜像 |
| macOS | `pkg` | PKG 安装器 |
| macOS | `zip` | ZIP 压缩包 |
| macOS | `mas` | Mac App Store |
| Linux | `AppImage` | AppImage |
| Linux | `snap` | Snap |
| Linux | `deb` | Debian 包 |
| Linux | `rpm` | RedHat 包 |

**对比**：
- 两者都支持主流格式
- electron-builder 格式更丰富

---

### 5. 自动更新

#### Electron Forge

需要安装额外插件：

```bash
npm install @electron-forge/publisher-github --save-dev
```

```javascript
// forge.config.js
publishers: [
  {
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'username',
        name: 'repo'
      },
      prerelease: false
    }
  }
]
```

在代码中：
```typescript
import { updateElectronApp } from 'update-electron-app';

updateElectronApp(); // 简单方式，使用默认配置
```

#### electron-builder（本项目配置）

内置 `electron-updater`：

```json
// electron-builder.json
{
  "publish": {
    "provider": "github",
    "owner": "username",
    "repo": "repo"
  }
}
```

在代码中：
```typescript
import { autoUpdater } from 'electron-updater';

// 检查更新
autoUpdater.checkForUpdatesAndNotify();

// 详细控制
autoUpdater.on('update-available', (info) => {
  console.log('版本', info.version);
});

autoUpdater.on('download-progress', (progress) => {
  console.log('进度', progress.percent);
});
```

**对比**：
- Forge：需要插件，配置简单但功能有限
- Builder：内置支持，功能强大，控制精细

---

### 6. 代码签名

#### Electron Forge

```javascript
// forge.config.js
packagerConfig: {
  // macOS 签名
  osxSign: {
    identity: 'Developer ID Application: Your Name (TEAMID)',
    'hardened-runtime': true,
    entitlements: 'entitlements.plist',
    'entitlements-inherit': 'entitlements.plist'
  },
  
  // macOS 公证
  osxNotarize: {
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_PASSWORD
  }
}
```

#### electron-builder

```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAMID)",
    "hardenedRuntime": true,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  
  "afterSign": "scripts/notarize.js"
}
```

**对比**：
- 两者配置类似
- Builder 更简洁，文档更详细

---

### 7. 社区和生态

#### Electron Forge

- **GitHub Stars**：~6.3k
- **NPM 下载量**：~50k/周
- **文档**：官方文档，但有时不够详细
- **示例**：官方模板，社区示例较少
- **问题解决**：GitHub Issues，回复较慢

#### electron-builder

- **GitHub Stars**：~13.6k
- **NPM 下载量**：~500k/周（10倍）
- **文档**：社区文档，非常详细
- **示例**：大量社区项目和模板
- **问题解决**：Stack Overflow、GitHub Discussions，活跃

---

## 🎯 选择建议

### 选择 Electron Forge 的场景

✅ **适合：**

1. **新项目从零开始**
   - 想要完整的官方工具链
   - 不想自己配置开发环境
   - 相信官方维护的稳定性

2. **喜欢官方方案**
   - 追求官方支持
   - 愿意等待官方更新
   - 希望与 Electron 保持同步

3. **需要热更新开发**
   - 想要开箱即用的热更新
   - 不想自己配置 webpack-dev-server

4. **项目较简单**
   - 不需要复杂的自定义配置
   - 标准的 Electron 应用

**示例项目**：
- VS Code（使用 Forge 的早期版本）
- Slack Desktop（部分功能）
- Discord（开发工具）

---

### 选择 electron-builder 的场景（本项目）

✅ **适合：**

1. **已有项目或成熟项目**
   - 已经配置好开发环境（如 Vite、Webpack）
   - 只需要打包功能
   - 不想重构项目结构

2. **需要强大的打包功能**
   - 多平台发布
   - 代码签名和公证
   - 自动更新（精细控制）
   - ASAR 优化

3. **社区支持重要**
   - 需要丰富的示例
   - 遇到问题容易找到解决方案
   - 第三方集成多

4. **灵活性要求高**
   - 自定义构建流程
   - 集成现有前端框架（React、Vue、Angular）
   - 需要复杂的配置

**示例项目**：
- Atom（GitHub）
- Hyper（终端）
- GitKraken
- **本项目 Behavior3Editor**

---

### 本项目为什么选择 electron-builder？

```typescript
// package.json
{
  "scripts": {
    "dev": "vite",                                    // 使用 Vite 开发
    "build": "tsc && vite build && electron-builder" // 使用 builder 打包
  }
}
```

**原因**：

1. ✅ **已有 Vite 构建配置**
   - 使用 `vite-plugin-electron` 开发
   - 热更新已配置好
   - 不需要 Forge 的开发工具

2. ✅ **打包需求明确**
   - Windows NSIS 安装器
   - macOS DMG + ZIP
   - ASAR 归档
   - 自动更新支持

3. ✅ **配置简单**
   - 单一 `electron-builder.json` 文件
   - 与 Vite 配置分离
   - 易于维护

4. ✅ **社区支持**
   - 大量类似项目可参考
   - 文档详细
   - 问题容易解决

---

## 🔄 迁移指南

### 从 electron-builder 迁移到 Electron Forge

如果你想尝试官方工具链：

**步骤 1**：安装 Forge

```bash
npm install --save-dev @electron-forge/cli
npx electron-forge import
```

**步骤 2**：自动转换配置

Forge CLI 会：
- 分析 `package.json`
- 读取 `electron-builder.json`
- 生成 `forge.config.js`
- 更新 npm scripts

**步骤 3**：调整配置

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    name: 'Behavior3 Editor',
    icon: './public/favicon',
    // 从 electron-builder.json 迁移的配置
  },
  
  // 选择 Vite 插件（保持现有构建方式）
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // Vite 配置
      }
    }
  ],
  
  makers: [
    {
      name: '@electron-forge/maker-squirrel', // Windows
      config: {}
    },
    {
      name: '@electron-forge/maker-dmg',      // macOS
      config: {}
    }
  ]
};
```

**步骤 4**：测试

```bash
npm start          # 开发模式
npm run make       # 打包
```

---

### 从 Electron Forge 迁移到 electron-builder

如果你想要更灵活的配置：

**步骤 1**：安装 electron-builder

```bash
npm uninstall @electron-forge/cli
npm uninstall @electron-forge/maker-*
npm install --save-dev electron-builder
```

**步骤 2**：创建配置文件

```json
// electron-builder.json
{
  "appId": "com.example.app",
  "productName": "My App",
  "files": [
    "dist-electron",
    "dist"
  ],
  "directories": {
    "output": "release/${version}"
  }
}
```

**步骤 3**：调整构建脚本

```json
// package.json
{
  "scripts": {
    "dev": "vite",                           // 需要自己配置
    "build": "vite build && electron-builder"
  }
}
```

**步骤 4**：配置开发环境

如果需要热更新，安装 `vite-plugin-electron`：

```bash
npm install --save-dev vite-plugin-electron
```

---

## 📊 总结表格

| 方面 | Electron Forge | electron-builder | 本项目选择 |
|-----|---------------|------------------|-----------|
| **维护者** | Electron 官方 | 社区（loopline-systems） | builder ✅ |
| **定位** | 完整工具链 | 专注打包 | builder ✅ |
| **学习曲线** | 较陡 | 较平缓 | builder ✅ |
| **开发体验** | 内置热更新 | 需自己配置 | 已配置 Vite |
| **打包速度** | 中等 | 快 | builder ✅ |
| **配置复杂度** | 高（多文件） | 低（单文件） | builder ✅ |
| **自动更新** | 需插件 | 内置强大 | builder ✅ |
| **社区大小** | 中等 | 非常大 | builder ✅ |
| **文档质量** | 官方但不详细 | 社区但很详细 | builder ✅ |
| **适合场景** | 新项目 | 现有项目 | builder ✅ |

---

## 💡 实际建议

### 对于本项目

**保持使用 electron-builder**，因为：

1. ✅ 已经配置好 Vite + electron-builder
2. ✅ 打包功能满足需求
3. ✅ 配置简单易维护
4. ✅ 社区支持丰富

**除非**：
- ❌ 想要官方工具链
- ❌ 需要重构整个项目
- ❌ 有特殊的 Forge 独有功能需求

### 对于新项目

**如果满足以下条件，考虑 Forge**：
- 从零开始
- 相信官方方案
- 不在意学习成本
- 不需要复杂自定义

**其他情况，推荐 electron-builder**：
- 快速上手
- 灵活配置
- 社区支持
- 文档详细

---

## 🔗 相关资源

- [Electron Forge 官方文档](https://www.electronforge.io/)
- [electron-builder 文档](https://www.electron.build/)
- [对比讨论](https://github.com/electron/electron/discussions)
- [社区投票](https://2022.stateofjs.com/en-US/libraries/build-tools/)

---

## 🎓 核心要点

### Electron Forge
- ✅ 官方工具链
- ✅ 开发体验好
- ❌ 学习曲线陡
- ❌ 社区较小

### electron-builder（本项目）
- ✅ 专注打包
- ✅ 配置简单
- ✅ 社区活跃
- ❌ 需要自己配置开发环境

### 选择建议
- **新项目 + 官方方案** → Forge
- **现有项目 + 灵活性** → electron-builder ✅（本项目）
- **不确定** → electron-builder（更安全的选择）

现在你应该完全理解这两个工具的区别了！本项目使用 electron-builder 是非常合理的选择。🎉

