# Behavior3Editor 代码阅读指南

## 📋 项目概述

**Behavior3Editor** 是一个**可视化行为树编辑器**，用于游戏开发。它允许策划人员在不写代码的情况下设计复杂的游戏逻辑，如 AI、技能、BUFF 等。

### 核心功能
- 可视化编辑行为树（拖拽创建节点、连线）
- 多文件管理（工作区、多标签页）
- 节点参数配置（属性面板）
- 子树引用和导入
- 变量管理和自动补全
- 导出为 JSON 文件供游戏使用

### 技术栈
- **Electron**: 跨平台桌面应用框架
- **React + TypeScript**: 前端 UI
- **AntD**: UI 组件库
- **G6**: 图形可视化库（用于绘制行为树）
- **Zustand**: 状态管理

> 💡 **本指南专注于编辑器部分，跳过运行时执行逻辑**

---

## 🎯 学习路线（专注编辑器）

### 学习策略

**从数据格式 → 界面分工 → 数据流 → 组件实现**

您不需要：
- ❌ 理解行为树的执行逻辑（tick、onTick等）
- ❌ 深入学习 TypeScript/JavaScript 语法
- ❌ 成为 React 专家

您只需要：
- ✅ 理解 JSON 数据格式（编辑器的输入和输出）
- ✅ 理解编辑器的组件分工（哪个组件负责什么）
- ✅ 理解数据如何流动（用户操作 → 数据更新 → 界面刷新）
- ✅ 通过注释理解代码意图

---

## 📖 推荐阅读顺序

### 阶段 0：前置知识（30分钟）

#### 0.1 技术栈分工
```
md/技术栈.md                         # 了解各技术在界面上的职责
```

**重点理解界面分工：**
- **Electron**: 窗口、文件对话框、菜单栏
- **React**: 所有自定义组件（Explorer、Editor、Inspector）
- **AntD**: 基础UI组件（按钮、输入框、树形控件、标签页）
- **G6**: 行为树画布（节点、连线、布局）
- **Zustand**: 全局数据管理（工作区状态、编辑器列表）

#### 0.2 TypeScript 基础语法速查

**您只需要认识这些语法（遇到时对照即可）：**

```typescript
// 1. 类型注解
const name: string = "Hero";           // 变量类型声明
const age: number = 10;

// 2. 接口（数据结构定义）
interface Person {
  name: string;                        // 必需属性
  age?: number;                        // 可选属性（?）
}

// 3. 对象
const hero: Person = { name: "Hero", age: 10 };

// 4. 数组
const list: string[] = ["a", "b", "c"];

// 5. 函数
const add = (a: number, b: number): number => {
  return a + b;
};

// 6. 可选链（安全调用）
editor?.dispatch?.("save");            // 如果不存在不会报错

// 7. 解构赋值
const { name, age } = person;          // 提取对象属性
const [first, second] = array;         // 提取数组元素

// 8. 箭头函数
() => { console.log("执行"); }         // 匿名函数

// 9. JSX（React 的 HTML 语法）
<div className="container">Hello</div> // 看起来像HTML，实际是JS
```

> 💡 **不用记忆**：阅读代码时对照即可

---

### 阶段 1：理解数据格式（1小时）⭐⭐⭐ 从这里开始！

**编辑器的本质：编辑 JSON 文件的可视化工具**

#### 1.1 行为树文件格式（输出格式）

```
📂 示例文件（必看）
sample/workdir/hero.json           # 英雄AI ⭐⭐⭐ 重点看这个
sample/workdir/monster.json        # 怪物AI
sample/workdir/sub/subtree1.json   # 子树示例
```

**打开 `sample/workdir/hero.json`：**

```json
{
  "version": "1.8.5",              // 格式版本
  "name": "Hero",                  // 树名称
  "prefix": "hero",                // 变量前缀（命名空间）
  "desc": "英雄AI行为树",          // 描述
  "export": false,                 // 是否可导出为子树
  "group": ["Hero"],               // 分组标签
  "import": [],                    // 导入的子树
  "vars": [                        // 变量声明（文档说明）
    { "name": "hp", "desc": "生命值" }
  ],
  "root": {                        // 根节点（树的入口）
    "id": "1",
    "name": "Sequence",            // 节点类型
    "children": [                  // 子节点列表
      {
        "id": "2",
        "name": "Wait",
        "args": { "time": 1.0 }    // 节点参数
      },
      {
        "id": "3",
        "name": "Log",
        "args": { "message": "Hello" }
      }
    ]
  }
}
```

**对应的行为树结构：**
```
Sequence (顺序执行)
  ├─ Wait (等待1秒)
  └─ Log (输出"Hello")
```

**重点字段：**
- `root`: 根节点，整棵树的入口
- `id`: 节点唯一标识
- `name`: 节点类型（Wait、Sequence、Log等）
- `args`: 节点的配置参数
- `children`: 子节点列表（递归结构）
- `input`/`output`: 输入输出变量名（可选）
- `vars`: 变量声明列表（可选，用于文档）

**学习方法：**
1. 用编辑器打开 `sample/workspace.b3-workspace`
2. 打开 `hero.json` 观察画布
3. 点击节点，查看右侧属性面板
4. 对照 JSON 文件，理解可视化 ↔ JSON 的对应关系

#### 1.2 节点定义配置（输入格式）

```
sample/node-config.b3-setting      # 节点定义 ⭐⭐⭐
```

**这个文件告诉编辑器：有哪些节点可用，每个节点有什么参数。**

```json
{
  "name": "Wait",                  // 节点名称
  "type": "Action",                // 节点类型
  "desc": "等待指定时间",          // 描述
  "args": [                        // 参数定义
    {
      "name": "time",              // 参数名
      "type": "float",             // 参数类型
      "desc": "等待时间（秒）",
      "default": 1.0               // 默认值
    }
  ],
  "input": [],                     // 输入变量定义
  "output": [],                    // 输出变量定义
  "children": 0                    // 子节点数量限制（0=无子节点）
}
```

**节点类型：**
- `Action`: 行为节点（无子节点）
- `Composite`: 复合节点（多个子节点）
- `Decorator`: 装饰节点（1个子节点）
- `Condition`: 条件节点（无子节点）

**参数类型：**
- `int`: 整数
- `float`: 浮点数
- `string`: 字符串
- `bool`: 布尔值
- `json`: JSON对象
- `expr`: 表达式
- 加 `?` 表示可选：`int?`
- 加 `[]` 表示数组：`int[]`

#### 1.3 工作区配置

```
sample/workspace.b3-workspace      # 工作区配置
```

```json
{
  "files": [                       // 项目包含的文件
    { "path": "hero.json", "desc": "英雄AI" },
    { "path": "monster.json", "desc": "怪物AI" }
  ],
  "settings": {
    "checkExpr": true,             // 是否检查表达式语法
    "buildScript": "scripts/build.js"  // 构建脚本
  }
}
```

#### 1.4 数据结构 TypeScript 定义

```
src/misc/b3type.ts                 # 所有数据结构的 TypeScript 定义 ⭐⭐⭐
```

**核心接口（对应 JSON 格式）：**

```typescript
// 节点数据（JSON中的每个节点）
interface NodeData {
  id: string;
  name: string;
  desc?: string;
  args?: { [key: string]: unknown };
  input?: string[];
  output?: string[];
  children?: NodeData[];  // 递归
  debug?: boolean;
  disabled?: boolean;
}

// 行为树数据（JSON文件整体）
interface TreeData {
  version: string;
  name: string;
  prefix: string;
  desc?: string;
  export?: boolean;
  group: string[];
  import: string[];
  vars: VarDecl[];
  root: NodeData;  // 根节点
}

// 变量声明
interface VarDecl {
  name: string;
  desc: string;
}

// 节点定义（node-config.b3-setting）
interface NodeDef {
  name: string;
  type: "Action" | "Decorator" | "Condition" | "Composite";
  desc: string;
  args?: {...}[];
  input?: string[];
  output?: string[];
  children?: -1 | 0 | 1 | 2 | 3;  // 子节点数量限制
}
```

**学习方法：**
- 打开 JSON 文件和 b3type.ts 对照阅读
- 理解 TypeScript 接口 = JSON 结构的类型描述
- 文件中有详细的中文注释

**目标**：完全理解编辑器处理的数据格式

---

### 阶段 2：编辑器组件分工（1小时）⭐⭐⭐

**理解界面的各个部分由哪个组件负责**

#### 2.1 整体布局

```
src/components/workspace.tsx       # 主布局 ⭐⭐⭐
```

**布局结构：**
```
┌─────────────────────────────────────────────┐
│  TitleBar (标题栏)                           │
│  [文件] [编辑] [视图] ...                    │
├──────────┬──────────────────────┬───────────┤
│          │                      │           │
│ Explorer │   Editor (Tabs)      │ Inspector │
│          │                      │           │
│ 文件树    │   hero.json  *       │ 属性面板   │
│          │  ┌─────────────────┐ │           │
│ [📁 root]│  │ G6 Canvas       │ │ 节点属性： │
│  [📄 a]  │  │ ┌────┐  ┌────┐  │ │ name: Wait│
│  [📄 b]  │  │ │Wait│→ │Log │  │ │ time: 1.0 │
│          │  │ └────┘  └────┘  │ │           │
│          │  └─────────────────┘ │           │
└──────────┴──────────────────────┴───────────┘
```

**workspace.tsx 的职责：**
- 管理整体布局（三栏）
- 管理多标签页（Tabs 组件）
- 处理全局快捷键
- 显示欢迎页面

**关键代码：**
```typescript
<Layout>
  <Header><TitleBar /></Header>
  <Layout>
    <Sider><Explorer /></Sider>       {/* 左侧 */}
    <Content>
      <Tabs activeKey={editing?.path}>  {/* 中间，多标签页 */}
        {editors.map(editor => (
          <Editor data={editor} />
        ))}
      </Tabs>
    </Content>
    <Inspector />                      {/* 右侧 */}
  </Layout>
</Layout>
```

#### 2.2 文件管理（左侧）

```
src/components/explorer.tsx        # 文件树 ⭐⭐⭐
```

**职责：**
- 显示工作区的文件树
- 显示可用的节点定义树
- 处理文件操作（新建、删除、重命名、移动）
- 支持拖拽（文件移动、节点拖拽到画布）

**关键功能：**
- 点击文件 → 打开文件（调用 `workspace.open(path)`）
- 右键菜单 → 文件操作
- 拖拽节点到画布 → 创建节点

**数据来源：**
- `workspace.fileTree`: 文件树数据（从文件系统扫描）
- `workspace.nodeDefs`: 节点定义（从 node-config.b3-setting 加载）

#### 2.3 画布编辑（中间）

```
src/components/editor.tsx          # 编辑器组件 ⭐⭐⭐
src/components/graph.ts            # G6 图形渲染 ⭐⭐⭐
```

**editor.tsx 的职责：**
- 管理画布容器
- 处理搜索功能
- 分发编辑事件（保存、撤销、重做等）
- 监听编辑器切换

**graph.ts 的职责：**
- 使用 G6 渲染行为树
- 处理节点操作（添加、删除、移动、复制粘贴）
- 管理撤销/重做历史
- 处理拖拽、缩放、选中等交互

**关键方法（graph.ts）：**
```typescript
class Graph {
  constructor(editor, ref);        // 创建 G6 实例
  
  // 节点操作
  createNode();                    // 创建节点
  deleteNode();                    // 删除节点
  copyNode();                      // 复制节点
  pasteNode();                     // 粘贴节点
  
  // 视图操作
  refresh();                       // 刷新画布
  focusNode(id);                   // 聚焦节点
  selectNode(id);                  // 选中节点
  
  // 文件操作
  save();                          // 保存文件
  reload();                        // 重新加载
  
  // 撤销重做
  undo();
  redo();
}
```

#### 2.4 属性编辑（右侧）

```
src/components/inspector.tsx       # 属性面板 ⭐⭐
```

**职责：**
- 显示当前选中节点的属性
- 提供参数编辑界面（根据参数类型显示不同控件）
- 显示树的全局属性（名称、描述、变量等）
- 显示节点定义的文档

**根据不同类型显示不同控件：**
- `int`/`float`: `<InputNumber>` 数字输入框
- `string`: `<Input>` 文本输入框
- `bool`: `<Switch>` 开关
- `expr`: `<TextArea>` 表达式编辑器（带验证）
- 有 `options`: `<Select>` 下拉选择框
- 数组类型: 可添加/删除的列表

#### 2.5 标题栏（顶部）

```
src/components/titlebar.tsx        # 标题栏 ⭐
```

**职责：**
- 显示当前文件名
- 提供菜单（文件、编辑、视图等）
- 窗口控制按钮（最小化、最大化、关闭）

#### 2.6 节点渲染

```
src/components/register-node.ts    # 自定义节点渲染器 ⭐⭐
```

**职责：**
- 定义节点在画布上的视觉样式
- 根据节点类型显示不同图标和颜色
- 显示节点的参数、输入输出
- 处理节点的不同状态（选中、悬停、错误、禁用）

**目标**：理解编辑器界面的分工，知道修改什么功能要改哪个文件

---

### 阶段 3：状态管理和数据流（2小时）⭐⭐⭐ 最重要！

**理解数据如何在编辑器中流动**

#### 3.1 全局状态（Zustand Store）

```
src/contexts/workspace-context.ts  # 工作区状态 ⭐⭐⭐
src/contexts/setting-context.ts    # 应用设置
```

**workspace-context.ts 核心概念：**

```typescript
// EditorStore：一个打开的文件
class EditorStore {
  path: string;           // 文件路径
  data: TreeData;         // 行为树数据
  changed: boolean;       // 是否已修改
  mtime: number;          // 文件修改时间
  dispatch?: (event, data) => void;  // 事件分发
}

// WorkspaceStore：全局工作区状态
type WorkspaceStore = {
  // 项目信息
  workdir: string;                // 工作目录
  path: string;                   // 工作区文件路径
  
  // 文件管理
  allFiles: Map<string, FileMeta>;  // 所有文件元数据
  fileTree?: FileTreeType;          // 文件树结构
  
  // 编辑器管理
  editors: EditorStore[];           // 所有打开的编辑器
  editing?: EditorStore;            // 当前正在编辑的
  
  // 节点定义
  nodeDefs: NodeDefs;               // 所有节点定义
  
  // 编辑状态
  editingNode?: EditNode;           // 正在编辑的节点
  editingTree?: EditTree;           // 正在编辑的树属性
  
  // 操作方法
  open(path): void;                 // 打开文件
  edit(path): void;                 // 切换编辑器
  close(path): void;                // 关闭文件
  save(): void;                     // 保存文件
  // ... 更多方法
};
```

**理解重点：**
- `editors`: 所有打开的文件列表
- `editing`: 当前活动的编辑器（决定哪个标签页显示）
- `editingNode`: 当前选中的节点（决定属性面板显示什么）
- `fileTree`: 文件树数据（左侧显示）
- `nodeDefs`: 节点定义（节点面板显示）

#### 3.2 数据流：打开文件

```
用户点击文件树中的 hero.json
  ↓
【Explorer组件】
  DirectoryTree.onSelect 事件
  ↓
  dispatch("open", node)
  ↓
【Workspace状态】
  workspace.open(path)
  ├─ 检查是否已打开
  ├─ 创建 EditorStore(path)
  │  └─ readTree(path) → 读取JSON文件 → 解析为TreeData
  ├─ workspace.editors.push(editor)
  └─ workspace.edit(path)
     └─ set({ editing: editor })  ← Zustand状态更新
  ↓
【React组件自动响应】（Zustand触发）
  ├─ Workspace.tsx
  │  └─ <Tabs activeKey={editing?.path}> 切换标签页
  ├─ Explorer.tsx
  │  └─ 高亮选中的文件
  ├─ Editor.tsx
  │  └─ useEffect检测editing变化 → refreshGraph()
  │     └─ graph.refresh() → G6重新渲染
  └─ Inspector.tsx
     └─ 显示树的属性
  ↓
【G6画布】
  渲染节点和连线
  ↓
用户看到行为树可视化界面
```

**关键文件：**
- `explorer.tsx:875-881` - 点击文件的入口
- `workspace-context.ts:902-924` - open() 方法
- `workspace-context.ts:926-936` - edit() 方法
- `workspace.tsx:482-527` - Tabs 组件响应状态
- `editor.tsx:305-318` - useEffect 监听切换

#### 3.3 数据流：编辑节点

```
用户点击画布上的节点
  ↓
【Graph】
  G6 捕获点击事件
  ↓
  graph.selectNode(id)
  ↓
【Workspace状态】
  workspace.onEditingNode({
    data: nodeData,        // 节点数据
    prefix: "hero",        // 前缀
    disabled: false,       // 状态
  })
  ↓
  set({ editingNode: {...} })  ← 更新状态
  ↓
【Inspector组件响应】
  检测到 editingNode 变化
  ↓
  渲染属性表单
  ├─ 节点名称
  ├─ 节点描述
  ├─ 参数列表（根据 NodeDef.args 生成）
  └─ 输入输出变量
  ↓
用户修改参数（如 time: 1 → time: 2）
  ↓
【Inspector】
  Form.onChange 事件
  ↓
  editor.dispatch("updateNode", newData)
  ↓
【Editor → Graph】
  graph.updateNode(newData)
  ↓
  更新 NodeData.args
  ↓
  editor.changed = true  ← 标记未保存
  ↓
  G6 重新渲染节点
```

**关键文件：**
- `graph.ts` - 节点选中和更新
- `inspector.tsx` - 属性表单
- `workspace-context.ts` - editingNode 状态

#### 3.4 数据流：保存文件

```
用户按 Ctrl+S 或点击保存
  ↓
【快捷键 / 菜单】
  workspace.save() 或 editor.dispatch("save")
  ↓
【Graph】
  graph.save()
  ├─ 遍历 G6 图形数据
  ├─ 提取所有 NodeData
  ├─ 构建 TreeData 对象
  └─ writeTree(path, treeData)
     └─ JSON.stringify(treeData)
     └─ fs.writeFileSync(path, json)
  ↓
文件保存成功
  ↓
  editor.changed = false  ← 清除未保存标记
  editor.mtime = now      ← 更新修改时间
```

**关键文件：**
- `graph.ts` - save() 方法
- `misc/util.ts` - writeTree() 工具函数

#### 3.5 数据流：创建节点

```
用户从节点面板拖拽 Wait 节点到画布
  ↓
【Explorer】
  onDragStart: 设置 dataTransfer = "Wait"
  ↓
【Graph / Editor】
  onDrop: 捕获拖拽事件
  ↓
【Graph】
  graph.createNode("Wait")
  ├─ 查找 NodeDef（从 workspace.nodeDefs）
  ├─ 生成唯一ID（如 "node_5"）
  ├─ 创建 NodeData {
  │    id: "node_5",
  │    name: "Wait",
  │    args: { time: 1.0 }  // 使用默认值
  │  }
  ├─ 添加到父节点的 children
  └─ G6 重新渲染
  ↓
  editor.changed = true  ← 标记未保存
  ↓
新节点显示在画布上
```

**关键文件：**
- `graph.ts` - createNode() 方法
- `explorer.tsx` - 节点拖拽

**目标**：理解数据如何在组件间流动

---

### 阶段 4：关键组件实现（按需深入）

**只在需要修改对应功能时才深入阅读**

#### 4.1 文件树组件详解

```
src/components/explorer.tsx        # ✓ 已添加详细注释
```

**关键功能和代码位置：**

| 功能 | 代码位置 | 说明 |
|-----|---------|------|
| 打开文件 | 行717-721 | dispatch("open") → workspace.open() |
| 新建文件 | 行737-750 | 创建临时节点 → 进入编辑状态 |
| 新建文件夹 | 行723-736 | 类似新建文件 |
| 重命名 | 行683-713 | submitRename() → fs.renameSync() |
| 删除 | 行790-799 | 移动到回收站（可恢复） |
| 复制粘贴 | 行770-774, 751-768 | fs.copyFileSync() |
| 拖拽移动 | 行801-813 | doMoveFile() → fs.renameSync() |

**阅读方法：**
- 文件已添加详细中文注释
- 先看注释理解功能
- 需要修改时再看具体代码

#### 4.2 画布编辑器详解

```
src/components/graph.ts            # G6 图形编辑器
```

**核心功能和方法：**

| 功能 | 方法 | 说明 |
|-----|------|------|
| 初始化 | `constructor()` | 创建 G6 实例，配置布局和交互 |
| 刷新画布 | `refresh()` | 重新渲染整棵树 |
| 创建节点 | `createNode()` | 在选中节点下创建子节点 |
| 删除节点 | `deleteNode()` | 删除选中节点及其子树 |
| 复制粘贴 | `copyNode()`, `pasteNode()` | 节点复制粘贴 |
| 替换节点 | `replaceNode()` | 替换节点类型，保留子节点 |
| 更新节点 | `updateNode()` | 更新节点数据（参数修改） |
| 选中节点 | `selectNode()` | 选中节点，更新属性面板 |
| 聚焦节点 | `focusNode()` | 滚动到节点位置 |
| 保存文件 | `save()` | 收集数据，写入文件 |
| 撤销重做 | `undo()`, `redo()` | 历史记录管理 |

**G6 配置：**
```typescript
new G6Graph({
  container: ref.current,           // React 引用的 DOM 容器
  
  node: {
    type: "TreeNode",               // 自定义节点类型
    style: { ... },                 // 节点样式
  },
  
  edge: {
    type: "cubic-horizontal",       // 曲线连接
    style: { ... },                 // 连线样式
  },
  
  layout: {
    type: "compact-box",            // 树形布局算法
    direction: "LR",                // 从左到右
    getHeight: ...,                 // 节点高度
    getWidth: ...,                  // 节点宽度
    getVGap: ...,                   // 垂直间距
    getHGap: ...,                   // 水平间距
  },
  
  behaviors: [
    "drag-canvas",                  // 拖拽画布
    "zoom-canvas",                  // 缩放画布
    "hover-activate",               // 悬停激活
  ],
});
```

**事件监听：**
```typescript
// 画布点击 → 取消选中
this._graph.on(CanvasEvent.CLICK, () => {
  this.selectNode(null);
});

// 节点点击 → 选中节点
this._graph.on(NodeEvent.CLICK, (event) => {
  const nodeId = event.target.id;
  this.selectNode(nodeId);
});

// 节点双击 → 编辑子树
this._graph.on(NodeEvent.DBLCLICK, (event) => {
  this.editSubtree();
});

// 拖拽 → 创建节点
this._graph.on(CanvasEvent.DROP, (event) => {
  const nodeName = event.dataTransfer.getData("explore-node");
  this.createNode(nodeName);
});
```

#### 4.3 属性面板详解

```
src/components/inspector.tsx       # 属性面板
```

**核心功能：**

1. **显示节点属性**
```typescript
// 监听 workspace.editingNode 变化
useEffect(() => {
  if (editingNode) {
    // 根据 NodeDef 生成表单
    // 填充当前值
    // 渲染编辑控件
  }
}, [editingNode]);
```

2. **根据参数类型渲染不同控件**
```typescript
// 数字类型 → InputNumber
if (isIntType(arg.value_type) || isFloatType(arg.value_type)) {
  return <InputNumber value={value} onChange={...} />;
}

// 字符串类型 → Input
if (isStringType(arg.value_type)) {
  return <Input value={value} onChange={...} />;
}

// 布尔类型 → Switch
if (isBoolType(arg.value_type)) {
  return <Switch checked={value} onChange={...} />;
}

// 表达式类型 → TextArea（带语法检查）
if (isExprType(arg.value_type)) {
  return <TextArea value={value} onChange={...} />;
}

// 有选项 → Select
if (hasArgOptions(arg)) {
  return <Select options={arg.options} onChange={...} />;
}
```

3. **变量自动补全**
```typescript
// 输入变量时提供补全建议
<AutoComplete
  options={availableVars}  // 从 workspace.usingVars 获取
  onSelect={...}
/>
```

#### 4.4 工具函数库

```
src/misc/b3util.ts                 # 行为树工具函数 ⭐⭐
```

**核心函数（编辑器相关）：**

| 函数 | 功能 |
|-----|------|
| `createNewTree()` | 创建新的空行为树 |
| `isTreeFile()` | 检查是否为行为树文件 |
| `isValidVariableName()` | 验证变量名 |
| `checkNodeArgValue()` | 验证节点参数值 |
| `refreshVarDecl()` | 刷新变量声明列表 |
| `buildProject()` | 构建项目（导出所有树） |
| `exportNodeDefs()` | 导出节点定义 |

**目标**：理解编辑器的具体实现（按需查看）

---

### 阶段 5：文件系统监听（30分钟）

**理解编辑器如何检测文件变化**

```
src/contexts/workspace-context.ts:1017-1063  # watch() 方法
```

**监听机制：**

```typescript
fs.watch(workdir, { recursive: true }, (event, filename) => {
  // 1. rename 事件：文件/文件夹创建、删除、重命名
  if (event === "rename") {
    workspace.loadTrees();  // 重新加载文件树
  }
  
  // 2. change 事件：文件内容修改
  if (event === "change") {
    if (filename === "node-config.b3-setting") {
      workspace.loadNodeDefs();  // 重新加载节点定义
    } else {
      // 检查对应的编辑器
      const editor = workspace.find(filename);
      if (editor.changed) {
        editor.alertReload = true;  // 提示重新加载
      } else {
        editor.dispatch("reload");  // 自动重新加载
      }
    }
  }
});
```

**效果：**
- 外部修改文件 → 编辑器自动检测 → 提示重新加载
- 修改节点定义 → 自动刷新节点面板
- 新建/删除文件 → 自动刷新文件树

---

## 🎯 快速查找指南（编辑器专用）

### 我想理解/修改...

| 需求 | 查看文件 | 关键位置 |
|-----|---------|---------|
| **JSON文件格式** | `sample/workdir/hero.json` | 整个文件 |
| **节点定义格式** | `sample/node-config.b3-setting` | 整个文件 |
| **数据结构定义** | `src/misc/b3type.ts` | NodeData, TreeData 接口 |
| **打开文件流程** | `src/components/explorer.tsx` | 行717-721, 注释 |
| **切换标签页** | `src/components/workspace.tsx` | 行482-527, 注释 |
| **保存文件流程** | `src/components/graph.ts` | save() 方法 |
| **创建节点** | `src/components/graph.ts` | createNode() 方法 |
| **删除节点** | `src/components/graph.ts` | deleteNode() 方法 |
| **节点属性编辑** | `src/components/inspector.tsx` | 整个文件 |
| **节点渲染样式** | `src/components/register-node.ts` | TreeNode 类 |
| **文件树操作** | `src/components/explorer.tsx` | dispatch() 方法 |
| **全局状态** | `src/contexts/workspace-context.ts` | WorkspaceStore |
| **工具函数** | `src/misc/b3util.ts` | 各个函数 |

---

## 💡 学习技巧（编辑器专用）

### 1. 从界面反推代码

**推荐学习方法：**

```
看界面 → 确定功能 → 找对应组件 → 看注释 → 理解实现
```

**示例：**
1. 我想知道"重命名文件"怎么实现
2. 界面上：右键文件 → 重命名
3. 推断：应该在 Explorer 组件
4. 打开 `explorer.tsx`
5. 搜索 "rename"
6. 找到 `submitRename()` 函数
7. 看注释理解流程

### 2. 关注数据流，不关注语法

**重点关注：**
- ✅ 数据从哪来（文件系统、用户输入、状态管理）
- ✅ 数据到哪去（更新状态、写入文件、渲染界面）
- ✅ 数据如何转换（JSON → TreeData → G6Data）

**不用关注：**
- ❌ TypeScript 的复杂语法
- ❌ React Hooks 的实现细节
- ❌ G6 的底层原理

### 3. 使用已添加的注释

**所有编辑器核心文件都已添加详细中文注释：**
- ✅ `explorer.tsx` - 文件树组件
- ✅ `workspace.tsx` - 主布局组件
- ✅ `workspace-context.ts` - 状态管理
- ✅ `b3type.ts` - 数据结构定义

**阅读策略：**
1. 先看文件头部注释（整体功能）
2. 再看函数/方法注释（具体功能）
3. 遇到不懂的代码，看注释而不是扣语法
4. 必要时看代码，但重点是理解逻辑流程

### 4. 画数据流图

**建议画这些图：**

#### 图1：组件关系图
```
Workspace (主容器)
  ├─ TitleBar (标题栏)
  ├─ Explorer (文件树)
  │   └─ DirectoryTree (AntD 组件)
  ├─ Editor (编辑器)
  │   └─ Graph (G6 画布)
  └─ Inspector (属性面板)
      └─ Form (AntD 表单)
```

#### 图2：状态管理图
```
Zustand Store (全局状态)
  ├─ WorkspaceStore
  │   ├─ editors: EditorStore[]
  │   ├─ editing: EditorStore (当前)
  │   ├─ fileTree: FileTreeType
  │   ├─ nodeDefs: NodeDef[]
  │   └─ editingNode: EditNode
  └─ SettingStore
      ├─ recent: string[]
      └─ layout: "compact" | "normal"
```

#### 图3：数据流图（打开文件）
```
Explorer
  └→ workspace.open(path)
      └→ new EditorStore(path)
          └→ readTree(path) → TreeData
      └→ workspace.edit(path)
          └→ set({ editing: editor })
              └→ Workspace: Tabs 切换
              └→ Editor: refreshGraph()
                  └→ Graph: G6 渲染
```

### 5. 对比学习

**JSON 文件 ↔ 界面元素对照：**

| JSON 字段 | 界面显示位置 |
|----------|------------|
| `name` | 标题栏文件名、标签页名称 |
| `desc` | 属性面板 - 树描述 |
| `vars` | 属性面板 - 变量列表 |
| `root` | 画布 - 整棵树 |
| `root.children[0]` | 画布 - 第一个子节点 |
| `node.name` | 画布 - 节点标题 |
| `node.args.time` | 属性面板 - time 参数 |
| `node.input` | 属性面板 - 输入变量 |
| `node.output` | 属性面板 - 输出变量 |

---

## 🛠️ 实践任务（编辑器专用）

### 任务1：理解数据格式（30分钟）⭐⭐⭐

```
1. 用文本编辑器打开 sample/workdir/hero.json
2. 用 Behavior3 Editor 打开 sample/workspace.b3-workspace
3. 打开 hero.json
4. 对照 JSON 文件和画布：
   - root.id="1" 对应哪个节点？
   - root.children[0] 对应哪个节点？
   - args.time 在界面哪里显示？
5. 点击节点，观察右侧属性面板
6. 修改参数，观察 JSON 的变化（保存后查看文件）
```

**目标：**
- ✅ 完全理解 JSON ↔ 界面的对应关系
- ✅ 知道编辑器修改了什么数据

### 任务2：追踪打开文件流程（30分钟）

```
1. 在 explorer.tsx 的 dispatch("open") 处添加断点或 console.log
2. 在 workspace-context.ts 的 open() 方法添加断点
3. 在 editor.tsx 的 useEffect 添加断点
4. 启动编辑器，点击文件
5. 观察调用顺序和数据变化
```

**目标：**
- ✅ 理解打开文件的完整调用链
- ✅ 知道数据如何从文件系统 → 画布

### 任务3：修改节点颜色（30分钟）

```
1. 打开 src/components/register-node.ts
2. 找到节点颜色定义（搜索 "fill" 或颜色值如 "#5B8FF9"）
3. 修改颜色值
4. 保存文件
5. 重启编辑器（npm run dev）
6. 观察节点颜色变化
```

**目标：**
- ✅ 知道如何修改节点的视觉样式
- ✅ 理解代码修改 → 界面更新的流程

### 任务4：添加树的自定义属性（1小时）

**需求：** 给行为树添加一个"优先级"属性

**步骤：**

1. **修改数据结构** (`src/misc/b3type.ts`)
```typescript
interface TreeData {
  // ... 现有字段
  priority?: number;  // 添加这行
}
```

2. **修改属性面板** (`src/components/inspector.tsx`)
   - 搜索树属性的表单部分
   - 添加优先级输入框

3. **修改保存逻辑** (`src/components/graph.ts`)
   - 确保保存时包含 priority 字段

4. **测试**
   - 打开文件，添加优先级
   - 保存文件
   - 查看 JSON 文件是否包含 priority

**目标：**
- ✅ 理解如何扩展数据模型
- ✅ 知道修改涉及哪些文件

### 任务5：理解撤销/重做（1小时）

```
1. 在画布上创建几个节点
2. 按 Ctrl+Z 撤销
3. 按 Ctrl+Shift+Z 重做
4. 打开 src/components/graph.ts
5. 查找 undo() 和 redo() 方法
6. 理解历史记录如何存储和恢复
```

**目标：**
- ✅ 理解撤销/重做的实现机制

---

## 📝 学习检查清单（编辑器专用）

### ✅ 阶段1：数据格式（必须掌握）
- [ ] 我能看懂 hero.json 的每个字段
- [ ] 我理解 NodeData 的结构（id、name、args、children）
- [ ] 我理解 TreeData 的结构（name、root、vars、import）
- [ ] 我知道 node-config.b3-setting 的作用（定义有哪些节点）
- [ ] 我能手写一个简单的行为树 JSON 文件

### ✅ 阶段2：组件分工（必须掌握）
- [ ] 我知道 Explorer 负责文件树
- [ ] 我知道 Editor 负责画布编辑
- [ ] 我知道 Inspector 负责属性面板
- [ ] 我知道 Workspace 负责整体布局
- [ ] 我知道 Graph 负责 G6 渲染

### ✅ 阶段3：数据流（必须掌握）
- [ ] 我理解打开文件的完整流程
- [ ] 我理解切换标签页的机制（activeKey 绑定）
- [ ] 我理解选中节点 → 属性面板更新的流程
- [ ] 我理解修改参数 → 保存文件的流程
- [ ] 我知道 Zustand 状态如何触发组件更新

### ✅ 阶段4：具体实现（按需掌握）
- [ ] 我知道如何创建节点（createNode）
- [ ] 我知道如何删除节点（deleteNode）
- [ ] 我知道撤销/重做如何实现
- [ ] 我知道如何修改节点渲染样式
- [ ] 我知道如何添加新的树属性

---

## 🔍 代码导航速查（编辑器专用）

### 数据格式
```
JSON格式          sample/workdir/hero.json
节点定义格式      sample/node-config.b3-setting
TypeScript定义    src/misc/b3type.ts
```

### 组件实现
```
主布局           src/components/workspace.tsx (已注释)
文件树           src/components/explorer.tsx (已注释)
编辑器           src/components/editor.tsx
画布渲染          src/components/graph.ts
属性面板          src/components/inspector.tsx
标题栏           src/components/titlebar.tsx
节点渲染器        src/components/register-node.ts
```

### 状态管理
```
工作区状态        src/contexts/workspace-context.ts
应用设置          src/contexts/setting-context.ts
```

### 工具和配置
```
工具函数          src/misc/b3util.ts
路径处理          src/misc/path.ts
国际化           src/misc/i18n.ts
文件IO           src/misc/util.ts
```

### 功能查找表

| 功能 | 文件 | 方法/位置 |
|-----|------|----------|
| 打开文件 | explorer.tsx | 行717 |
| 切换标签页 | workspace.tsx | 行498 onChange |
| 创建节点 | graph.ts | createNode() |
| 删除节点 | graph.ts | deleteNode() |
| 复制粘贴节点 | graph.ts | copyNode(), pasteNode() |
| 保存文件 | graph.ts | save() |
| 撤销重做 | graph.ts | undo(), redo() |
| 新建文件 | explorer.tsx | 行737 |
| 删除文件 | explorer.tsx | 行790 |
| 重命名文件 | explorer.tsx | 行683 |
| 编辑参数 | inspector.tsx | Form组件 |
| 文件监听 | workspace-context.ts | 行1017 watch() |

---

## 💬 常见问题（编辑器专用）

### Q1: 我不懂 React/TypeScript，能看懂编辑器代码吗？

**A**: 可以！因为：
1. **关键文件已添加详细中文注释**（explorer.tsx, workspace.tsx）
2. **数据格式很直观**（JSON 文件）
3. **可以从界面反推代码**（看到功能就能找到代码）

**建议：**
- 先理解数据格式（阶段1）
- 再理解组件分工（阶段2）
- 最后理解数据流（阶段3）
- 不用深究语法细节

### Q2: 编辑器和运行时的关系？

**A**: 
```
编辑器（本项目）                运行时（游戏中）
    ↓                              ↑
  生成 JSON                      读取 JSON
    ↓                              ↑
hero.json ←────────────────────→ hero.json
```

**编辑器只负责：**
- ✅ 可视化编辑
- ✅ 生成 JSON 文件
- ✅ 验证数据格式

**编辑器不负责：**
- ❌ 执行行为树（tick、onTick）
- ❌ 管理游戏状态
- ❌ 运行时逻辑

**关键理解：**
- 编辑器是"制作工具"
- JSON 文件是"产品"
- 游戏是"使用者"

### Q3: 我想修改界面，需要改哪些文件？

**A**: 根据修改位置：

| 修改内容 | 需要改的文件 |
|---------|------------|
| 文件树样式/功能 | `src/components/explorer.tsx` |
| 标签页布局 | `src/components/workspace.tsx` |
| 画布节点样式 | `src/components/register-node.ts` |
| 节点连线样式 | `src/components/graph.ts` (G6 edge 配置) |
| 属性面板布局 | `src/components/inspector.tsx` |
| 标题栏菜单 | `src/components/titlebar.tsx` |
| 菜单栏（原生） | `electron/main/index.ts` (Menu) |
| 快捷键 | `src/components/workspace.tsx` (useKeyPress) |

### Q4: 如何添加新的树属性？

**A**: 三步走：

```
1. 定义数据结构
   src/misc/b3type.ts
   → 在 TreeData 接口添加字段

2. 修改属性面板
   src/components/inspector.tsx
   → 添加表单控件

3. 确保保存时包含
   src/components/graph.ts (save方法)
   → 通常不用改，会自动保存所有字段
```

### Q5: 如何调试界面问题？

**A**: 使用浏览器开发者工具：

```
1. 启动编辑器: npm run dev
2. 按 F12 打开开发者工具
3. 使用 Console 查看日志
4. 使用 Elements 查看 DOM 结构
5. 使用 Sources 设置断点
```

**添加调试日志：**
```typescript
// 在任何位置添加
console.log("打开文件:", path);
console.log("节点数据:", nodeData);
```

### Q6: 编辑器的"源代码"在哪里？

**A**: 编辑器的源代码都在 `src/` 目录：

```
src/
├── components/      # UI 组件（界面）
├── contexts/        # 状态管理（数据）
├── misc/            # 工具函数（逻辑）
└── behavior3/       # 运行时库（您不需要关注）
```

**编译后的代码：**
```
dist/               # 编译后的前端代码
dist-electron/      # 编译后的 Electron 代码
release/            # 打包后的安装包
```

---

## 🎓 学习路线图（编辑器专用）

### 第1天：理解数据（2小时）

```
1. 阅读 md/技术栈.md                     [30分钟] 了解技术分工
2. 阅读 sample/workdir/hero.json        [20分钟] 看行为树格式
3. 阅读 sample/node-config.b3-setting   [20分钟] 看节点定义格式
4. 阅读 src/misc/b3type.ts              [50分钟] 理解数据结构
   - 重点：NodeData, TreeData, NodeDef
   - 方法：对照 JSON 文件阅读
```

**检查点：**
- ✅ 我能看懂 hero.json 的每个字段
- ✅ 我知道 TreeData 接口对应 JSON 结构
- ✅ 我理解 NodeDef 的作用

### 第2天：理解组件分工（2小时）

```
1. 启动编辑器观察界面                    [10分钟]
2. 阅读 src/components/workspace.tsx    [40分钟] 看注释，理解布局
3. 阅读 src/components/explorer.tsx     [40分钟] 看注释，理解文件树
4. 浏览 src/components/graph.ts         [30分钟] 看方法列表和注释
5. 浏览 src/components/inspector.tsx    [20分钟] 看注释
```

**检查点：**
- ✅ 我知道左侧文件树是 Explorer 组件
- ✅ 我知道中间画布是 Editor + Graph 组件
- ✅ 我知道右侧属性是 Inspector 组件
- ✅ 我知道标签页由 Tabs 组件管理

### 第3天：理解数据流（2小时）

```
1. 阅读 src/contexts/workspace-context.ts  [60分钟]
   - 重点：EditorStore, WorkspaceStore
   - 重点方法：open(), edit(), save()
   
2. 追踪打开文件流程                       [30分钟]
   - explorer.tsx (点击)
   - → workspace.open()
   - → workspace.edit()
   - → Tabs 切换
   - → Editor 刷新
   
3. 追踪保存文件流程                       [30分钟]
   - 按 Ctrl+S
   - → editor.dispatch("save")
   - → graph.save()
   - → 写入文件
```

**检查点：**
- ✅ 我理解 EditorStore 和 WorkspaceStore 的关系
- ✅ 我能追踪打开文件的完整调用链
- ✅ 我理解 Zustand 状态如何触发界面更新

### 第4天及以后：按需深入

**根据您的需求选择：**

| 需求 | 阅读内容 | 时间 |
|-----|---------|------|
| 修改文件操作 | `explorer.tsx` | 1小时 |
| 修改节点样式 | `register-node.ts` | 1小时 |
| 修改属性面板 | `inspector.tsx` | 2小时 |
| 理解 G6 渲染 | `graph.ts` + G6文档 | 3小时 |
| 添加新功能 | 相关组件 + React文档 | 按需 |

---

## 📚 核心文件详解

### 1. workspace-context.ts - 状态管理核心

**这是编辑器最重要的文件之一**

#### 核心数据结构

```typescript
// 单个编辑器实例
class EditorStore {
  path: string;              // 文件路径 "workdir/hero.json"
  data: TreeData;            // 行为树数据（JSON内容）
  declare: FileVarDecl;      // 变量声明信息
  changed: boolean;          // 是否已修改（显示 *）
  mtime: number;             // 文件修改时间
  alertReload: boolean;      // 是否提示重新加载
  focusId?: string;          // 要聚焦的节点ID
  dispatch?: Function;       // 事件分发器
}

// 工作区全局状态
type WorkspaceStore = {
  // 项目信息
  workdir: string;                    // 项目根目录
  path: string;                       // .b3-workspace 文件路径
  
  // 文件管理
  allFiles: Map<string, FileMeta>;    // 所有文件元数据
  fileTree: FileTreeType;             // 文件树（显示用）
  
  // 编辑器管理
  editors: EditorStore[];             // 所有打开的编辑器
  editing: EditorStore;               // 当前活动的编辑器 ⭐
  
  // 节点管理
  nodeDefs: NodeDef[];                // 所有节点定义
  
  // 编辑状态
  editingNode: EditNode;              // 正在编辑的节点 ⭐
  editingTree: EditTree;              // 正在编辑的树属性
  
  // ... 方法省略
};
```

#### 关键方法

```typescript
// 1. 打开文件
open(path) {
  // 检查是否已打开
  let editor = editors.find(v => v.path === path);
  
  if (!editor) {
    // 创建新编辑器
    editor = new EditorStore(path);  // 读取 JSON
    editors.push(editor);
  }
  
  // 切换到该编辑器
  this.edit(path);
}

// 2. 切换编辑器
edit(path) {
  const editor = editors.find(v => v.path === path);
  set({ editing: editor });  // ← 触发组件更新
}

// 3. 关闭文件
close(path) {
  // 从列表移除
  editors = editors.filter(v => v.path !== path);
  
  // 切换到其他编辑器
  if (path === editing?.path) {
    editing = editors[0];
  }
  
  set({ editors, editing });
}
```

### 2. graph.ts - G6 渲染核心

**这个文件封装了所有 G6 操作**

#### 核心结构

```typescript
class Graph {
  private _graph: G6Graph;        // G6 实例
  private _data: TreeData;        // 当前树数据
  private _history: History;      // 撤销/重做历史
  
  // 构造函数：创建 G6 实例
  constructor(editor, ref) {
    this._graph = new G6Graph({
      container: ref,
      node: { ... },      // 节点配置
      edge: { ... },      // 连线配置
      layout: { ... },    // 布局配置
      behaviors: [ ... ], // 交互行为
    });
    
    // 绑定事件
    this._graph.on("click", ...);
    this._graph.on("drop", ...);
  }
}
```

#### 关键方法分类

**文件操作：**
```typescript
save()           // 保存：TreeData → JSON 文件
reload()         // 重新加载：JSON → TreeData
refresh()        // 刷新画布：TreeData → G6 渲染
```

**节点操作：**
```typescript
createNode()     // 创建：生成 NodeData，添加到 children
deleteNode()     // 删除：从 children 移除
updateNode()     // 更新：修改 NodeData.args
copyNode()       // 复制：保存到剪贴板
pasteNode()      // 粘贴：从剪贴板创建节点
replaceNode()    // 替换：更改节点类型
```

**视图操作：**
```typescript
selectNode(id)   // 选中：高亮节点，显示属性
focusNode(id)    // 聚焦：滚动到节点位置
expandElement()  // 展开：展开所有折叠的节点
```

**历史操作：**
```typescript
undo()          // 撤销：恢复上一个状态
redo()          // 重做：前进到下一个状态
```

**子树操作：**
```typescript
editSubtree()      // 编辑子树：跳转到子树文件
saveAsSubtree()    // 另存为子树：保存选中部分为子树
```

### 3. inspector.tsx - 属性面板核心

**动态表单生成器**

#### 根据节点类型显示不同内容

```typescript
// 1. 如果选中的是节点
if (workspace.editingNode) {
  // 显示节点属性表单
  // - 节点名称（只读）
  // - 节点描述
  // - 参数列表（动态生成）
  // - 输入变量
  // - 输出变量
  // - 调试开关
  // - 禁用开关
}

// 2. 如果选中的是树
if (workspace.editingTree) {
  // 显示树属性表单
  // - 树名称
  // - 树描述
  // - 前缀
  // - 分组
  // - 导入列表
  // - 变量声明
}

// 3. 如果选中的是节点定义
if (workspace.editingNodeDef) {
  // 显示节点文档（只读）
  // - Markdown 格式的文档
}
```

#### 参数控件映射

```typescript
// 根据 NodeDef.args[i].value_type 决定显示什么控件

switch (arg.value_type) {
  case "int":
  case "float":
    return <InputNumber />;      // 数字输入
    
  case "string":
    return <Input />;            // 文本输入
    
  case "bool":
    return <Switch />;           // 开关
    
  case "expr":
    return <TextArea />;         // 表达式编辑器（带验证）
    
  case "json":
    return <TextArea />;         // JSON 编辑器
    
  default:
    if (hasArgOptions(arg)) {
      return <Select />;         // 下拉选择（有预定义选项）
    }
    return <Input />;            // 默认文本输入
}

// 如果是数组类型（如 int[]）
if (isArray(arg.value_type)) {
  // 渲染可添加/删除的列表
  return (
    <Form.List>
      {fields.map(field => (
        <Input />  {/* 或其他控件 */}
        <Button onClick={remove}>删除</Button>
      ))}
      <Button onClick={add}>添加</Button>
    </Form.List>
  );
}
```

### 4. explorer.tsx - 文件树核心

**已添加详细中文注释**

#### 核心功能

```typescript
// 1. 显示文件树（递归渲染）
<DirectoryTree
  treeData={workspace.fileTree}    // 文件树数据
  selectedKeys={selectedKeys}      // 选中的文件
  expandedKeys={expandedKeys}      // 展开的文件夹
  onSelect={...}                   // 点击文件 → 打开
  onDrop={...}                     // 拖拽 → 移动文件
  onRightClick={...}               // 右键 → 显示菜单
/>

// 2. 显示节点定义树
<DirectoryTree
  treeData={[nodeTree]}            // 节点定义树
  onSelect={...}                   // 点击 → 显示节点文档
  onDragStart={...}                // 拖拽 → 传递节点名称
/>
```

#### 事件处理中心

```typescript
const dispatch = (event, node, dest) => {
  switch (event) {
    case "open":       // 打开文件
    case "newFile":    // 新建文件
    case "newFolder":  // 新建文件夹
    case "rename":     // 重命名
    case "delete":     // 删除
    case "copy":       // 复制
    case "paste":      // 粘贴
    case "duplicate":  // 复制文件
    case "move":       // 移动（拖拽）
  }
};
```

---

## 🎯 您的学习路径总结

### 时间分配

| 阶段 | 内容 | 时间 | 优先级 |
|-----|------|------|--------|
| 0 | 前置知识 | 30分钟 | 必须 |
| 1 | 数据格式 | 2小时 | 必须 |
| 2 | 组件分工 | 2小时 | 必须 |
| 3 | 数据流 | 2小时 | 必须 |
| 4 | 具体实现 | 按需 | 可选 |
| 5 | 文件监听 | 30分钟 | 建议 |

**总计必须时间：约 7 小时**  
**完整掌握：约 10-15 小时**

### 学习成果

完成学习后，您将能够：

- ✅ 完全理解编辑器的数据格式
- ✅ 知道界面各部分由哪个组件负责
- ✅ 追踪任何功能的完整数据流
- ✅ 修改界面样式和布局
- ✅ 添加新的树/节点属性
- ✅ 调试和定位问题
- ✅ 扩展编辑器功能

### 学习建议

**第一周：理解架构**
- 第1-3天：阅读阶段 0-3
- 第4-5天：完成实践任务
- 第6-7天：追踪数据流

**第二周：动手实践**
- 修改简单样式
- 添加自定义属性
- 追踪和调试问题

**第三周及以后：深度开发**
- 根据需求修改功能
- 优化性能
- 添加新特性

---

## 📚 补充学习资源（按需）

### 前端基础（如果想深入）

**TypeScript：**
- 官方手册：https://www.typescriptlang.org/zh/docs/
- 只学基础：接口、类型、类
- 跳过高级：泛型、装饰器、高级类型

**React：**
- 官方文档：https://zh-hans.react.dev/
- 只学基础：组件、Props、State、useEffect
- 跳过高级：Context、Reducer、性能优化

**AntD：**
- 组件文档：https://ant.design/components/overview-cn
- 按需查阅：用到哪个组件看哪个

**G6：**
- 官方文档：https://g6.antv.antgroup.com/
- 重点：Graph API、自定义节点
- 跳过：布局算法实现、插件开发

### 调试工具

**Chrome DevTools：**
- F12 打开开发者工具
- Console：查看日志
- Elements：查看 DOM 结构
- Sources：设置断点
- Network：查看网络请求（本项目不需要）

**VS Code：**
- 设置断点（点击行号）
- F5 启动调试
- 查看变量值
- 单步执行

---

## 💡 最后的建议

### 学习心态

**您的优势：**
- ✅ 理解行为树概念（最重要！）
- ✅ 数据格式很直观（JSON）
- ✅ 已有详细中文注释
- ✅ 可以从界面反推代码

**不要担心：**
- ❌ 不懂前端框架 → 有注释帮助理解
- ❌ 不懂 TypeScript → 理解逻辑即可，不用会写
- ❌ 代码看不懂 → 关注数据流，不关注语法

### 学习方法

**推荐：**
1. **看界面** → 知道功能是什么
2. **找文件** → 知道功能在哪实现
3. **看注释** → 理解实现思路
4. **看代码** → 理解具体逻辑（可选）

**不推荐：**
1. ~~逐行阅读代码~~
2. ~~深究 TypeScript 语法~~
3. ~~研究 React 实现原理~~

### 记住

**您的目标：**
- 理解编辑器如何工作
- 能够修改和扩展功能
- 能够定位和解决问题

**不是：**
- 成为前端专家
- 记住所有语法
- 理解框架原理

---

## ✅ 开始您的学习之旅

1. **现在就开始**: 打开 `sample/workdir/hero.json`
2. **对照界面**: 启动编辑器，打开这个文件
3. **理解对应关系**: JSON → 界面
4. **按照路线图**: 一步步深入

祝您学习顺利！🎉

---

## 📖 附录：常用文件速查

### 核心文件清单

```
📁 数据格式
  sample/workdir/hero.json              行为树文件示例
  sample/node-config.b3-setting         节点定义示例
  src/misc/b3type.ts                    数据结构定义

📁 组件实现
  src/components/workspace.tsx          主布局 (✓ 已注释)
  src/components/explorer.tsx           文件树 (✓ 已注释)
  src/components/editor.tsx             编辑器
  src/components/graph.ts               G6 画布
  src/components/inspector.tsx          属性面板
  src/components/titlebar.tsx           标题栏
  src/components/register-node.ts       节点渲染

📁 状态管理
  src/contexts/workspace-context.ts     工作区状态
  src/contexts/setting-context.ts       应用设置

📁 工具函数
  src/misc/b3util.ts                    行为树工具
  src/misc/util.ts                      通用工具
  src/misc/path.ts                      路径处理

📁 Electron
  electron/main/index.ts                主进程
  electron/preload/index.ts             预加载脚本

📁 配置
  package.json                          项目配置
  vite.config.ts                        构建配置
  electron-builder.json                 打包配置
```

### 功能实现映射表

| 界面功能 | 实现位置 | 说明 |
|---------|---------|------|
| 打开项目 | `workspace-context.ts` init() | 加载工作区配置 |
| 文件树显示 | `explorer.tsx` | DirectoryTree 组件 |
| 打开文件 | `explorer.tsx` → workspace.open() | 创建 EditorStore |
| 切换标签 | `workspace.tsx` Tabs.onChange | 调用 workspace.edit() |
| 画布显示 | `graph.ts` refresh() | G6 渲染 |
| 拖拽节点 | `graph.ts` onDrop | 创建 NodeData |
| 点击节点 | `graph.ts` onClick | 选中并更新属性面板 |
| 编辑参数 | `inspector.tsx` Form | 更新 NodeData.args |
| 保存文件 | `graph.ts` save() | TreeData → JSON |
| 撤销重做 | `graph.ts` undo/redo | 历史记录管理 |
| 新建文件 | `explorer.tsx` dispatch("newFile") | 创建 JSON |
| 删除文件 | `explorer.tsx` dispatch("delete") | 移到回收站 |

---

## 🎉 总结

**编辑器的本质：**

```
可视化界面 ←→ JSON 文件
```

**编辑器的职责：**
1. 读取 JSON 文件
2. 渲染为可视化界面
3. 接收用户操作
4. 更新数据结构
5. 保存为 JSON 文件

**您需要理解的核心：**
1. **数据格式**：JSON 文件如何组织
2. **组件分工**：哪个组件负责什么
3. **数据流**：数据如何在组件间流动

**您不需要理解的：**
- 行为树如何执行（tick、onTick）
- TypeScript 的高级语法
- React/G6 的底层实现

按照本指南的路线图，专注于编辑器部分，您将能够高效地理解和修改这个项目！