# TSX 文件理解指南

## 📋 概述

**TSX = TypeScript + JSX**

- **TypeScript（TS）**: JavaScript 的超集，添加了类型系统
- **JSX**: JavaScript XML，允许在 JavaScript 中写类似 HTML 的语法
- **TSX**: 在 TypeScript 文件中使用 JSX 语法，用于编写 React 组件

本文档专为**不熟悉前端**的读者编写，帮助您快速理解 Behavior3 Editor 中的 TSX 文件。

---

## 🎯 核心概念

### 1. 文件扩展名区别

| 扩展名 | 说明 | 用途 |
|-------|------|------|
| `.js` | JavaScript 文件 | 普通 JS 代码 |
| `.jsx` | JavaScript + JSX | React 组件（无类型） |
| `.ts` | TypeScript 文件 | 带类型的 JS 代码 |
| `.tsx` | TypeScript + JSX | React 组件（带类型）⭐ |

**本项目中的 TSX 文件：**
```
src/components/
  ├── workspace.tsx     ← React 组件，带类型
  ├── explorer.tsx      ← React 组件，带类型
  ├── editor.tsx        ← React 组件，带类型
  ├── inspector.tsx     ← React 组件，带类型
  └── titlebar.tsx      ← React 组件，带类型
```

### 2. 什么是 JSX？

**传统 HTML：**
```html
<div class="container">
  <h1>Hello World</h1>
  <button onclick="handleClick()">Click</button>
</div>
```

**JSX（看起来像 HTML，实际是 JavaScript）：**
```tsx
<div className="container">
  <h1>Hello World</h1>
  <button onClick={handleClick}>Click</button>
</div>
```

**关键区别：**
- `className` 而不是 `class`（因为 class 是 JS 关键字）
- `onClick` 而不是 `onclick`（驼峰命名）
- `{handleClick}` 是 JavaScript 变量（不是字符串）

**JSX 的本质：**
```tsx
// 这段 JSX
<div className="container">Hello</div>

// 实际会被编译成
React.createElement('div', { className: 'container' }, 'Hello')
```

### 3. 什么是 TypeScript？

**JavaScript（无类型）：**
```javascript
function add(a, b) {
  return a + b;
}

add(1, 2);      // ✓ 3
add("1", "2");  // ✓ "12"（字符串拼接）
add(1, "2");    // ✓ "12"（类型自动转换）
```

**TypeScript（有类型）：**
```typescript
function add(a: number, b: number): number {
  return a + b;
}

add(1, 2);      // ✓ 3
add("1", "2");  // ✗ 编译错误：类型不匹配
add(1, "2");    // ✗ 编译错误：类型不匹配
```

**优势：**
- ✅ 编译时发现错误
- ✅ 代码提示更准确
- ✅ 重构更安全
- ✅ 代码可读性更好

---

## 📖 TSX 基础语法

### 1. 组件定义

#### 1.1 最简单的组件

```tsx
import { FC } from "react";

// FC = FunctionComponent（函数组件）
export const Hello: FC = () => {
  return <div>Hello World</div>;
};
```

**解释：**
- `export`: 导出组件，供其他文件使用
- `const Hello`: 组件名（必须大写开头）
- `FC`: React 的函数组件类型
- `= () => { ... }`: 箭头函数
- `return <div>...</div>`: 返回 JSX

#### 1.2 带参数的组件

```tsx
// 1. 定义参数类型（Props）
interface GreetingProps {
  name: string;          // 必需参数
  age?: number;          // 可选参数（?）
}

// 2. 使用参数类型
export const Greeting: FC<GreetingProps> = ({ name, age }) => {
  return (
    <div>
      <h1>Hello, {name}!</h1>
      {age && <p>Age: {age}</p>}
    </div>
  );
};

// 3. 使用组件
<Greeting name="Hero" age={25} />
```

**解释：**
- `interface GreetingProps`: 定义参数类型
- `FC<GreetingProps>`: 组件接收 GreetingProps 类型的参数
- `{ name, age }`: 解构 props
- `{name}`: 在 JSX 中嵌入变量
- `{age && ...}`: 条件渲染（age 存在才显示）

### 2. JSX 语法

#### 2.1 嵌入 JavaScript 表达式

```tsx
const name = "Hero";
const count = 10;

// 使用 {} 嵌入变量
<div>{name}</div>                     // Hello

// 嵌入表达式
<div>{count + 5}</div>                // 15

// 三元表达式
<div>{count > 5 ? "多" : "少"}</div>  // 多

// 函数调用
<div>{getName()}</div>

// 对象属性
<div>{user.name}</div>
```

#### 2.2 属性（Props）

```tsx
// 字符串属性（用引号）
<div className="container" id="main">

// JavaScript 表达式属性（用花括号）
<div style={{ color: "red", fontSize: 14 }}>
<input value={inputValue} />
<button onClick={handleClick} />

// 布尔属性
<input disabled={true} />
<input disabled />              // 简写，等价于 disabled={true}

// 展开属性
const props = { className: "box", id: "main" };
<div {...props} />              // 展开所有属性
```

**注意：**
- `className` 不是 `class`
- `style` 是对象：`{{ color: "red" }}`（双花括号）
- CSS 属性用驼峰：`fontSize` 不是 `font-size`

#### 2.3 条件渲染

```tsx
// 方式1：&& 运算符
{isLogin && <div>欢迎回来</div>}

// 方式2：三元表达式
{isLogin ? <div>欢迎</div> : <div>请登录</div>}

// 方式3：if 语句（在 return 之前）
let content;
if (isLogin) {
  content = <div>欢迎</div>;
} else {
  content = <div>请登录</div>;
}
return <div>{content}</div>;
```

#### 2.4 列表渲染

```tsx
const files = ["hero.json", "monster.json", "attack.json"];

// 使用 map 渲染列表
<div>
  {files.map((file) => (
    <div key={file}>{file}</div>
  ))}
</div>

// 结果：
// <div>hero.json</div>
// <div>monster.json</div>
// <div>attack.json</div>
```

**注意：**
- 列表项必须有 `key` 属性（唯一标识）
- `key` 帮助 React 高效更新列表

#### 2.5 事件处理

```tsx
// 点击事件
<button onClick={() => console.log("Clicked")}>
  Click Me
</button>

// 传递参数
<button onClick={() => deleteFile(path)}>
  Delete
</button>

// 使用命名函数
const handleClick = () => {
  console.log("Clicked");
};
<button onClick={handleClick}>Click</button>

// 访问事件对象
<input onChange={(e) => setValue(e.target.value)} />
```

**常见事件：**
- `onClick`: 点击
- `onChange`: 值改变（输入框）
- `onSubmit`: 表单提交
- `onFocus`: 获得焦点
- `onBlur`: 失去焦点
- `onKeyDown`: 按键按下
- `onDrop`: 拖拽放下

### 3. TypeScript 类型系统

#### 3.1 基本类型

```typescript
// 基本类型
const name: string = "Hero";
const age: number = 25;
const isActive: boolean = true;
const items: string[] = ["a", "b", "c"];

// 可选类型（|）
let value: string | number;
value = "hello";  // ✓
value = 123;      // ✓
value = true;     // ✗ 错误
```

#### 3.2 接口（Interface）

```typescript
// 定义数据结构
interface Person {
  name: string;          // 必需属性
  age?: number;          // 可选属性（?）
  hobbies: string[];     // 数组
}

// 使用接口
const hero: Person = {
  name: "Hero",
  age: 25,
  hobbies: ["coding", "gaming"]
};

// 访问属性
console.log(hero.name);    // "Hero"
console.log(hero.age);     // 25
```

#### 3.3 类型别名（Type）

```typescript
// 定义类型别名
type NodeType = "Action" | "Composite" | "Decorator" | "Condition";

// 使用
const type: NodeType = "Action";     // ✓
const type2: NodeType = "Unknown";   // ✗ 错误
```

#### 3.4 函数类型

```typescript
// 函数签名
function add(a: number, b: number): number {
  return a + b;
}

// 箭头函数
const multiply = (a: number, b: number): number => {
  return a * b;
};

// 简写（单行）
const square = (n: number): number => n * n;

// 无返回值
const log = (message: string): void => {
  console.log(message);
};
```

### 4. React Hooks

#### 4.1 useState（状态管理）

```tsx
import { useState } from "react";

export const Counter: FC = () => {
  // 声明状态
  const [count, setCount] = useState<number>(0);
  //      ↑      ↑                    ↑        ↑
  //    当前值  更新函数              类型    初始值
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        +1
      </button>
    </div>
  );
};
```

**理解：**
- `count`: 当前状态值
- `setCount`: 更新状态的函数
- `useState(0)`: 初始值为 0
- 调用 `setCount` 会触发组件重新渲染

#### 4.2 useEffect（副作用）

```tsx
import { useEffect } from "react";

export const FileWatcher: FC<{ path: string }> = ({ path }) => {
  const [content, setContent] = useState("");
  
  // 监听 path 变化
  useEffect(() => {
    // path 变化时执行
    const data = readFile(path);
    setContent(data);
  }, [path]);  // ← 依赖数组
  
  return <div>{content}</div>;
};
```

**理解：**
- `useEffect(fn, deps)`: 当 deps 变化时执行 fn
- `[path]`: 依赖数组，path 变化时重新执行
- `[]`: 空数组，只在组件挂载时执行一次
- 用于数据加载、订阅、定时器等

#### 4.3 useRef（引用 DOM）

```tsx
import { useRef } from "react";

export const FocusInput: FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const focusInput = () => {
    inputRef.current?.focus();  // 聚焦输入框
  };
  
  return (
    <div>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </div>
  );
};
```

**理解：**
- `useRef`: 获取 DOM 元素的引用
- `ref={inputRef}`: 绑定 ref
- `inputRef.current`: 访问 DOM 元素

---

## 🔧 Behavior3 Editor 中的 TSX 示例

### 示例1：workspace.tsx 简化版

```tsx
/**
 * Workspace 组件 - 主工作区
 */
import { FC } from "react";
import { Layout, Tabs } from "antd";  // AntD 组件
import { useWorkspace } from "../contexts/workspace-context";  // 状态管理

const { Header, Content, Sider } = Layout;

export const Workspace: FC = () => {
  // 1. 订阅全局状态（Zustand）
  const workspace = useWorkspace((state) => ({
    editors: state.editors,      // 所有编辑器
    editing: state.editing,      // 当前编辑器
    fileTree: state.fileTree,    // 文件树
    edit: state.edit,            // 切换编辑器方法
  }));
  
  // 2. 返回 JSX（界面结构）
  return (
    <Layout>
      {/* 标题栏 */}
      <Header>
        <TitleBar />
      </Header>
      
      <Layout>
        {/* 左侧文件树 */}
        <Sider width={300}>
          <Explorer />
        </Sider>
        
        {/* 中间编辑器区域 */}
        <Content>
          {/* 多标签页 */}
          <Tabs
            activeKey={workspace.editing?.path}  {/* 当前活动标签 */}
            onChange={(key) => workspace.edit(key)}  {/* 切换标签 */}
            items={workspace.editors.map((editor) => ({
              key: editor.path,
              label: editor.data.name,
              children: <Editor data={editor} />  {/* 编辑器组件 */}
            }))}
          />
        </Content>
        
        {/* 右侧属性面板 */}
        <Inspector />
      </Layout>
    </Layout>
  );
};
```

**理解要点：**
1. **导入**：引入需要的组件和函数
2. **状态**：使用 `useWorkspace` 获取全局状态
3. **JSX**：用类似 HTML 的语法描述界面
4. **数据绑定**：`{workspace.editing?.path}` 绑定数据
5. **事件处理**：`onChange={...}` 绑定事件
6. **组件嵌套**：`<Editor>` 嵌套在 `<Tabs>` 中

### 示例2：explorer.tsx 简化版

```tsx
/**
 * Explorer 组件 - 文件树
 */
import { FC, useState } from "react";
import { Tree } from "antd";

const { DirectoryTree } = Tree;

export const Explorer: FC = () => {
  // 1. 组件状态
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  //      ↑ 当前值     ↑ 更新函数           ↑ 类型       ↑ 初始值
  
  // 2. 事件处理函数
  const handleSelect = (keys: string[]) => {
    setSelectedKeys(keys);
    // 打开文件...
  };
  
  // 3. 渲染
  return (
    <div>
      <DirectoryTree
        treeData={[...]}                    // 树数据
        selectedKeys={selectedKeys}         // 选中的节点
        onSelect={(keys) => handleSelect(keys)}  // 选择事件
      />
    </div>
  );
};
```

**理解要点：**
1. **useState**: 管理组件内部状态
2. **事件处理**: `handleSelect` 函数处理选择事件
3. **数据绑定**: `selectedKeys={selectedKeys}` 绑定状态
4. **事件绑定**: `onSelect={...}` 绑定事件处理器

### 示例3：实际代码片段解析

#### 片段1：条件渲染（workspace.tsx）

```tsx
{/* 如果没有文件树，显示欢迎页面 */}
{!workspace.fileTree && (
  <Flex vertical align="center">
    <div>Behavior3 Editor</div>
    <Button onClick={() => workspace.createProject()}>
      创建新项目
    </Button>
  </Flex>
)}

{/* 如果有编辑器，显示标签页 */}
{workspace.editors.length > 0 && (
  <Tabs items={...} />
)}
```

**语法解释：**
- `{条件 && <JSX>}`: 如果条件为真，渲染 JSX
- `!workspace.fileTree`: fileTree 不存在
- `workspace.editors.length > 0`: 编辑器数量大于 0

#### 片段2：列表渲染（workspace.tsx）

```tsx
{/* 遍历所有编辑器，渲染标签页 */}
<Tabs
  items={workspace.editors.map((editor) => ({
    key: editor.path,                          // 唯一标识
    label: Path.basename(editor.path),         // 标签名
    children: <Editor data={editor} />         // 标签内容
  }))}
/>
```

**语法解释：**
- `.map()`: 数组遍历，转换成新数组
- `(editor) => ({...})`: 箭头函数，返回对象
- `key`: 列表项的唯一标识（React 要求）
- `<Editor data={editor} />`: 传递数据给子组件

#### 片段3：事件处理（explorer.tsx）

```tsx
{/* 点击文件时触发 */}
<DirectoryTree
  onSelect={(selectedKeys, info) => {
    const node = info.selectedNodes.at(0);
    if (node && !node.editing) {
      dispatch("open", node);  // 打开文件
      setSelectedKeys([node.path]);
    }
  }}
/>
```

**语法解释：**
- `onSelect={(keys, info) => {...}}`: 事件处理函数
- `info.selectedNodes.at(0)`: 获取第一个选中的节点
- `if (node && !node.editing)`: 条件判断
- `dispatch("open", node)`: 调用函数

#### 片段4：样式对象（workspace.tsx）

```tsx
<div style={{
  padding: "12px 24px",
  fontSize: "18px",
  fontWeight: "600"
}}>
  Explorer
</div>
```

**语法解释：**
- 外层 `{}`: JSX 表达式
- 内层 `{}`: JavaScript 对象
- CSS 属性驼峰命名：`fontSize` 不是 `font-size`
- 数值可以省略单位：`fontSize: 18` = `fontSize: "18px"`

---

## 🎓 TSX 常用模式

### 1. 组件 Props 模式

```tsx
// 定义 Props 接口
interface EditorProps {
  data: EditorStore;
  onChange: () => void;
  className?: string;     // 可选
}

// 使用 Props
export const Editor: FC<EditorProps> = ({ data, onChange, className }) => {
  // data、onChange、className 可以直接使用
  return <div className={className}>...</div>;
};

// 调用组件
<Editor 
  data={editorStore} 
  onChange={handleChange}
  className="my-editor"
/>
```

### 2. 状态更新模式

```tsx
// 简单值更新
const [count, setCount] = useState(0);
setCount(count + 1);

// 对象更新（不可变更新）
const [user, setUser] = useState({ name: "Hero", age: 25 });
setUser({ ...user, age: 26 });  // 展开运算符

// 数组更新
const [list, setList] = useState(["a", "b"]);
setList([...list, "c"]);        // 添加
setList(list.filter(v => v !== "a"));  // 删除
```

### 3. 副作用模式

```tsx
// 组件挂载时执行一次
useEffect(() => {
  console.log("组件已挂载");
}, []);

// 监听特定值变化
useEffect(() => {
  console.log("path 变化了:", path);
}, [path]);

// 清理副作用
useEffect(() => {
  const timer = setInterval(() => {...}, 1000);
  
  return () => {
    clearInterval(timer);  // 组件卸载时清理
  };
}, []);
```

### 4. 条件样式模式

```tsx
// 根据条件设置样式
<div style={{
  color: isActive ? "blue" : "gray",
  fontWeight: isSelected ? "bold" : "normal"
}}>

// 根据条件设置 className
<div className={isActive ? "active" : "inactive"}>

// 合并多个 className
<div className={`base ${isActive ? "active" : ""}`}>
```

### 5. 可选链模式

```tsx
// 安全访问（避免空指针错误）
editor?.dispatch?.("save");

// 等价于
if (editor && editor.dispatch) {
  editor.dispatch("save");
}

// 访问深层属性
const name = user?.profile?.name;

// 等价于
const name = user && user.profile && user.profile.name;
```

---

## 📊 workspace.tsx 完整解析

### 整体结构

```tsx
// ============ 导入部分 ============
import { FC, useEffect, useRef, useState } from "react";
import { Layout, Tabs, Button } from "antd";
import { useWorkspace } from "../contexts/workspace-context";
// ...

// ============ 类型定义 ============
const hotkeyMap: Record<string, EditEvent> = {
  [Hotkey.Copy]: "copy",
  // ...
};

// ============ 组件定义 ============
export const Workspace: FC = () => {
  // ---- 状态和引用 ----
  const workspace = useWorkspace(...);
  const [isShowingAlert, setShowingAlert] = useState(false);
  const keysRef = useRef<HTMLDivElement>(null);
  
  // ---- 副作用 ----
  useEffect(() => {
    // 文件变更检测
  }, [workspace.editing, workspace.modifiedTime]);
  
  // ---- 事件处理函数 ----
  const showSaveDialog = (editor) => {
    // ...
  };
  
  // ---- 渲染 JSX ----
  return (
    <Layout>
      <Header>...</Header>
      <Layout>
        <Sider>...</Sider>
        <Content>...</Content>
        <Inspector />
      </Layout>
    </Layout>
  );
};
```

### 关键代码详解

#### 1. 状态订阅（Zustand）

```tsx
const workspace = useWorkspace(
  useShallow((state) => ({
    save: state.save,
    editors: state.editors,
    editing: state.editing,
    // ...
  }))
);
```

**解释：**
- `useWorkspace`: 访问全局状态的 Hook
- `useShallow`: 性能优化（浅比较）
- `(state) => ({...})`: 选择需要的状态
- 结果：`workspace` 对象包含所有选中的状态和方法

#### 2. 快捷键处理

```tsx
useKeyPress(Hotkey.Save, keysRef, (event) => {
  event.preventDefault();
  workspace.save();
});
```

**解释：**
- `useKeyPress`: 自定义 Hook，监听键盘事件
- `Hotkey.Save`: 快捷键常量（Ctrl/Cmd + S）
- `keysRef`: 监听的 DOM 元素
- `(event) => {...}`: 事件处理函数
- `preventDefault()`: 阻止默认行为
- `workspace.save()`: 调用保存方法

#### 3. 多标签页渲染

```tsx
<Tabs
  hideAdd
  type="editable-card"
  activeKey={workspace.editing?.path}  {/* 绑定活动标签 */}
  onChange={(activeKey) => {            {/* 标签切换事件 */}
    workspace.edit(activeKey);
  }}
  onEdit={(activeKey, action) => {      {/* 编辑事件（关闭） */}
    if (action === "remove") {
      const editor = workspace.find(activeKey);
      if (editor && editor.changed) {
        showSaveDialog(editor);
      } else {
        workspace.close(activeKey);
      }
    }
  }}
  items={workspace.editors.map((v) => ({
    key: v.path,
    label: `${Path.basename(v.path)}${v.changed ? "*" : ""}`,
    children: <Editor data={v} onChange={forceUpdate} />
  }))}
/>
```

**解释：**
- `activeKey`: 当前活动的标签页
- `?.path`: 可选链（editing 可能为 undefined）
- `onChange`: 标签切换时触发
- `onEdit`: 编辑操作（关闭标签）
- `.map()`: 遍历编辑器列表，生成标签项
- `v.changed ? "*" : ""`: 三元表达式，显示未保存标记
- `<Editor data={v} />`: 渲染子组件

#### 4. 条件渲染

```tsx
{/* 欢迎页面：只在未打开项目时显示 */}
{!workspace.fileTree && (
  <Flex vertical align="center">
    <div>Behavior3 Editor</div>
    <Button onClick={() => workspace.createProject()}>
      创建新项目
    </Button>
  </Flex>
)}

{/* 标签页：只在有编辑器时显示 */}
{workspace.editors.length > 0 && (
  <Tabs items={...} />
)}
```

**解释：**
- `!workspace.fileTree`: fileTree 为 null/undefined
- `&&`: 逻辑与运算符，条件为真时渲染 JSX
- `workspace.editors.length > 0`: 有编辑器时

---

## 📚 explorer.tsx 完整解析

### 核心结构

```tsx
export const Explorer: FC = () => {
  // ============ 状态 ============
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [copyFile, setCopyFile] = useState("");
  const [newName, setNewName] = useState<string | null>(null);
  
  // ============ 订阅全局状态 ============
  const workspace = useWorkspace((state) => ({
    fileTree: state.fileTree,
    nodeDefs: state.nodeDefs,
    open: state.open,
    // ...
  }));
  
  // ============ 副作用：自动展开选中文件 ============
  useEffect(() => {
    if (workspace.editing) {
      const keys: React.Key[] = [];
      resolveKeys(workspace.editing.path, workspace.fileTree!, keys);
      setExpandedKeys(keys);
      setSelectedKeys([workspace.editing.path]);
    }
  }, [workspace.editing]);  // 依赖：editing 变化时执行
  
  // ============ 事件处理 ============
  const dispatch = (event: MenuEvent, node: FileTreeType) => {
    switch (event) {
      case "open":
        if (b3util.isTreeFile(node.path)) {
          workspace.open(node.path);  // 调用全局方法
        }
        break;
      // ... 其他事件
    }
  };
  
  // ============ 渲染 ============
  return (
    <Flex vertical>
      {/* 标题 */}
      <div style={{ padding: "12px 24px" }}>
        <span>Explorer</span>
      </div>
      
      {/* 文件树 */}
      <DirectoryTree
        treeData={workspace.fileTree ? [workspace.fileTree] : []}
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        onExpand={(keys) => setExpandedKeys(keys)}
        onSelect={(_, info) => {
          const node = info.selectedNodes.at(0);
          if (node && !node.editing) {
            dispatch("open", node);
          }
        }}
        onDrop={(info) => {
          dispatch("move", info.dragNode, info.node);
        }}
      />
    </Flex>
  );
};
```

**关键语法：**
1. **多个 useState**: 管理多个状态
2. **useEffect**: 响应 editing 变化
3. **三元表达式**: `fileTree ? [fileTree] : []`
4. **箭头函数**: `(keys) => setExpandedKeys(keys)`
5. **解构**: `info.selectedNodes.at(0)`
6. **方法调用**: `workspace.open(path)`

---

## 💡 理解 TSX 的关键技巧

### 1. 把 JSX 看作"模板"

**传统方式（命令式）：**
```javascript
const div = document.createElement('div');
div.className = 'container';
div.textContent = 'Hello';
document.body.appendChild(div);
```

**TSX 方式（声明式）：**
```tsx
<div className="container">Hello</div>
```

**理解：**
- JSX 描述"界面应该是什么样"
- 不是"如何操作 DOM"
- 更简洁、更直观

### 2. 理解花括号 {}

**在 JSX 中，`{}` 是"逃逸"到 JavaScript：**

```tsx
// 静态内容
<div>Hello</div>

// 动态内容（使用 {}）
<div>{name}</div>
<div>{count + 1}</div>
<div>{getTitle()}</div>

// 属性中的 {}
<div style={{ color: "red" }}>  {/* 双 {{}} */}
//         ↑              ↑
//     JSX表达式      JS对象

// 事件处理中的 {}
<button onClick={() => handleClick()}>
//              ↑              ↑
//          箭头函数     函数调用
```

### 3. 组件就是函数

```tsx
// 组件定义
const MyComponent = () => {
  return <div>Hello</div>;
};

// 组件使用
<MyComponent />

// 等价于调用函数
MyComponent()
```

**理解：**
- 组件 = 返回 JSX 的函数
- `<MyComponent />` = 调用函数
- React 负责何时调用、如何渲染

### 4. Props 就是函数参数

```tsx
// 定义组件
const Greeting = ({ name, age }) => {
  return <div>Hello, {name}! Age: {age}</div>;
};

// 使用组件
<Greeting name="Hero" age={25} />

// 等价于调用函数
Greeting({ name: "Hero", age: 25 })
```

### 5. State 触发重新渲染

```tsx
const [count, setCount] = useState(0);

// 用户点击按钮
<button onClick={() => setCount(count + 1)}>+1</button>

// 流程：
// 1. 用户点击
// 2. 调用 setCount(1)
// 3. React 检测到状态变化
// 4. 重新调用组件函数
// 5. 重新渲染界面
// 6. 界面显示新的 count 值
```

---

## 🔍 常见模式速查

### 1. 导入导出

```tsx
// 导入 React
import { FC, useState, useEffect } from "react";

// 导入 AntD 组件
import { Button, Input, Form } from "antd";

// 导入自定义组件
import { Explorer } from "./explorer";

// 导入类型
import { NodeData, TreeData } from "../misc/b3type";

// 导入全部
import * as fs from "fs";

// 导出组件
export const MyComponent: FC = () => {...};

// 导出类型
export interface MyData {...}

// 导出函数
export const myFunction = () => {...};
```

### 2. 类型注解

```tsx
// 变量
const name: string = "Hero";
const items: NodeData[] = [];

// 函数参数和返回值
const add = (a: number, b: number): number => a + b;

// 对象
const user: { name: string; age: number } = {
  name: "Hero",
  age: 25
};

// 数组
const list: string[] = ["a", "b"];
const list2: Array<string> = ["a", "b"];  // 等价

// 联合类型
let value: string | number | null;

// 可选类型
interface Props {
  required: string;
  optional?: number;  // ?表示可选
}
```

### 3. 解构赋值

```tsx
// 对象解构
const { name, age } = person;
const { data, onChange } = props;

// 数组解构
const [first, second] = array;
const [count, setCount] = useState(0);

// 嵌套解构
const { user: { name, age } } = data;

// 重命名
const { name: userName } = user;

// 默认值
const { name = "Unknown" } = user;
```

### 4. 展开运算符

```tsx
// 数组展开
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5];  // [1, 2, 3, 4, 5]

// 对象展开
const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 };  // { a: 1, b: 2, c: 3 }

// 更新对象属性（不可变更新）
const user = { name: "Hero", age: 25 };
const updated = { ...user, age: 26 };  // { name: "Hero", age: 26 }

// JSX 中展开 props
const props = { className: "box", id: "main" };
<div {...props} />  // <div className="box" id="main">
```

### 5. 箭头函数

```tsx
// 传统函数
function add(a, b) {
  return a + b;
}

// 箭头函数
const add = (a, b) => {
  return a + b;
};

// 单行简写（隐式返回）
const add = (a, b) => a + b;

// 无参数
const greeting = () => console.log("Hello");

// 单个参数（可省略括号）
const square = n => n * n;

// 返回对象（需要括号）
const makeUser = (name) => ({ name: name, age: 25 });
```

---

## 🎯 阅读 TSX 文件的策略

### 策略1：自顶向下

```
1. 看文件头部注释 → 理解整体功能
2. 看导入语句 → 知道用了哪些库和组件
3. 看类型定义 → 理解数据结构
4. 看组件签名 → 知道组件接收什么参数
5. 看 return 语句 → 理解界面结构
6. 看事件处理 → 理解交互逻辑
7. 看状态和副作用 → 理解数据流
```

### 策略2：从界面反推

```
1. 看界面上的元素 → 按钮、输入框、树等
2. 在 JSX 中找到对应的标签 → <Button>、<Input>、<Tree>
3. 看绑定的数据 → value={...}、items={...}
4. 看绑定的事件 → onClick={...}、onChange={...}
5. 追踪事件处理函数 → 找到具体逻辑
6. 理解数据如何更新 → setState、dispatch等
```

### 策略3：关注数据流

```
1. 找到数据来源
   - useState: 组件内部状态
   - useWorkspace: 全局状态
   - Props: 父组件传递
   - 文件系统: fs.readFileSync

2. 追踪数据流动
   - 数据 → 界面：{data.name}
   - 界面 → 数据：onChange={e => setData(e.value)}
   - 数据 → 文件：save() → writeFile

3. 理解数据更新触发的重新渲染
   - setState → 组件重新渲染
   - Zustand set() → 订阅组件重新渲染
```

---

## 📖 实际示例：完整分析一个文件

### 以 workspace.tsx 为例

#### 第1步：看文件头部

```tsx
/**
 * Workspace 组件 - 应用主工作区
 * 
 * 职责：
 * 1. 整体布局
 * 2. 多标签页管理
 * 3. 全局快捷键
 * ...
 */
```

**理解：** 这是主布局组件

#### 第2步：看导入

```tsx
import { FC, useEffect, useRef, useState } from "react";
import { Layout, Tabs, Button } from "antd";
import { useWorkspace } from "../contexts/workspace-context";
```

**理解：**
- 使用 React 的 Hooks
- 使用 AntD 的布局和标签页组件
- 使用全局状态管理

#### 第3步：看类型定义

```tsx
const hotkeyMap: Record<string, EditEvent> = {
  [Hotkey.Copy]: "copy",
  // ...
};
```

**理解：** 快捷键映射表

#### 第4步：看组件签名

```tsx
export const Workspace: FC = () => {
```

**理解：**
- 导出的函数组件
- 无参数（没有 `FC<Props>`）

#### 第5步：看状态和订阅

```tsx
const workspace = useWorkspace(...);  // 全局状态
const [isShowingAlert, setShowingAlert] = useState(false);  // 组件状态
const keysRef = useRef<HTMLDivElement>(null);  // DOM 引用
```

**理解：**
- `workspace`: 从 Zustand store 获取的全局状态
- `isShowingAlert`: 组件内部状态（是否显示对话框）
- `keysRef`: DOM 元素引用（用于快捷键监听）

#### 第6步：看副作用

```tsx
useEffect(() => {
  if (editor?.alertReload) {
    // 显示重新加载对话框
  }
}, [workspace.editing, workspace.modifiedTime]);
```

**理解：**
- 当 editing 或 modifiedTime 变化时执行
- 用于检测文件外部修改

#### 第7步：看 JSX 结构

```tsx
return (
  <Layout>                  {/* 整体布局 */}
    <Header>...</Header>    {/* 标题栏 */}
    <Layout>
      <Sider>...</Sider>    {/* 左侧边栏 */}
      <Content>...</Content> {/* 中间内容 */}
      <Inspector />         {/* 右侧面板 */}
    </Layout>
  </Layout>
);
```

**理解：**
- 三栏布局
- Header、Sider、Content 是 AntD 的布局组件
- `{/* ... */}`: JSX 注释语法

---

## 🎓 学习建议

### 对于不熟悉前端的读者

**不要：**
- ❌ 试图理解所有 TypeScript 语法
- ❌ 深究 React 的实现原理
- ❌ 逐行阅读代码

**应该：**
- ✅ 关注数据结构（interface）
- ✅ 关注数据流（从哪来，到哪去）
- ✅ 看注释理解功能
- ✅ 从界面反推代码

### 学习路径

```
第1步：理解 JSX 是什么
  └→ 类似 HTML 的 JavaScript 语法

第2步：认识基本语法
  └→ {变量}、条件渲染、列表渲染

第3步：理解组件
  └→ 组件 = 函数，返回 JSX

第4步：理解 Props
  └→ Props = 函数参数

第5步：理解 State
  └→ State = 组件内部数据，变化触发重新渲染

第6步：阅读实际代码
  └→ 看注释，理解逻辑，不扣语法
```

### 遇到不懂的语法

**查阅本文档的速查表：**
- 基础语法（导入导出、类型注解）
- JSX 语法（条件渲染、列表渲染）
- React Hooks（useState、useEffect）
- 常用模式（解构、展开、箭头函数）

**或使用 AI 辅助：**
- "这段代码做什么？"
- "这个语法什么意思？"

**不要死记硬背：**
- 理解逻辑比记住语法更重要
- 需要修改时再查具体语法

---

## 📝 TSX vs HTML 对照表

| HTML | TSX | 说明 |
|------|-----|------|
| `<div class="box">` | `<div className="box">` | class 是 JS 关键字 |
| `<label for="input">` | `<label htmlFor="input">` | for 是 JS 关键字 |
| `<input onclick="...">` | `<input onClick={...}>` | 驼峰命名 |
| `<div style="color: red">` | `<div style={{color: "red"}}>` | 对象形式 |
| `<div>` | `<div>` | 标签相同 |
| `<img src="...">` | `<img src="..." />` | 自闭合标签加 `/` |
| `<!-- 注释 -->` | `{/* 注释 */}` | JSX 注释语法 |
| 静态内容 | `{动态内容}` | 嵌入表达式 |

---

## 🔧 常见 JSX 模式

### 模式1：组件组合

```tsx
// 父组件
const Workspace = () => {
  return (
    <Layout>
      <Explorer />    {/* 子组件1 */}
      <Editor />      {/* 子组件2 */}
      <Inspector />   {/* 子组件3 */}
    </Layout>
  );
};

// 子组件
const Explorer = () => {
  return <div>File Tree</div>;
};
```

### 模式2：条件渲染的多种方式

```tsx
// 方式1：&& 运算符（只渲染或不渲染）
{isLogin && <div>欢迎</div>}

// 方式2：三元表达式（二选一）
{isLogin ? <div>欢迎</div> : <div>请登录</div>}

// 方式3：函数
const renderContent = () => {
  if (isLogin) return <div>欢迎</div>;
  return <div>请登录</div>;
};
{renderContent()}

// 方式4：变量
let content = null;
if (isLogin) content = <div>欢迎</div>;
{content}
```

### 模式3：列表 + 条件

```tsx
{files
  .filter(f => f.isTree)           // 过滤
  .sort((a, b) => a.name.localeCompare(b.name))  // 排序
  .map(f => (                      // 渲染
    <div key={f.path}>{f.name}</div>
  ))
}
```

### 模式4：表单绑定

```tsx
const [name, setName] = useState("");

<input 
  value={name}                      // 绑定值
  onChange={(e) => setName(e.target.value)}  // 更新状态
/>
```

---

## 🎯 Behavior3 Editor 中的 TSX 特点

### 1. AntD 组件使用频繁

```tsx
// 布局
<Layout>
  <Sider>...</Sider>
  <Content>...</Content>
</Layout>

// 表单
<Form>
  <Form.Item label="名称">
    <Input />
  </Form.Item>
</Form>

// 树形控件
<Tree treeData={data} onSelect={...} />

// 标签页
<Tabs items={items} activeKey={...} onChange={...} />
```

### 2. Zustand 状态管理

```tsx
// 订阅状态
const workspace = useWorkspace((state) => ({
  editing: state.editing,
  open: state.open,
}));

// 使用状态
<div>{workspace.editing?.path}</div>

// 调用方法
<button onClick={() => workspace.open(path)}>
```

### 3. 类型安全

```tsx
// 定义 Props 类型
interface EditorProps {
  data: EditorStore;
  onChange: () => void;
}

// 编译时检查
<Editor 
  data={editor}       // ✓ EditorStore 类型
  onChange={handler}  // ✓ () => void 类型
/>

<Editor 
  data="错误"         // ✗ 编译错误：类型不匹配
/>
```

### 4. 条件渲染很常见

```tsx
{/* 未打开项目 */}
{!workspace.fileTree && <WelcomePage />}

{/* 无编辑器 */}
{workspace.editors.length === 0 && <HotkeyGuide />}

{/* 有编辑器 */}
{workspace.editors.length > 0 && <Tabs ... />}
```

---

## 💡 快速理解技巧

### 技巧1：把 TSX 文件分成几部分看

```tsx
// ========== 第1部分：导入 ==========
import ...

// ========== 第2部分：类型定义 ==========
interface Props {...}
type State = {...}

// ========== 第3部分：组件函数 ==========
export const Component: FC<Props> = (props) => {
  // ---- 第3.1部分：状态和引用 ----
  const [state, setState] = useState(...);
  const ref = useRef(null);
  
  // ---- 第3.2部分：副作用 ----
  useEffect(() => {...}, [deps]);
  
  // ---- 第3.3部分：事件处理函数 ----
  const handleClick = () => {...};
  
  // ---- 第3.4部分：JSX 返回 ----
  return (
    <div>...</div>
  );
};
```

### 技巧2：忽略语法，理解意图

**示例：**
```tsx
const workspace = useWorkspace(
  useShallow((state) => ({
    editing: state.editing,
    open: state.open,
  }))
);
```

**不要纠结：**
- `useShallow` 是什么？
- 为什么要这样写？

**只需理解：**
- 这段代码获取全局状态
- `workspace.editing` 是当前编辑器
- `workspace.open` 是打开文件的方法

### 技巧3：看类型理解数据

**示例：**
```tsx
interface NodeData {
  id: string;
  name: string;
  children?: NodeData[];
}

const node: NodeData = {...};
```

**理解：**
- `NodeData` 是一个数据结构
- 有 `id`、`name` 属性（字符串）
- 有 `children` 属性（可选，NodeData 数组）
- 是递归结构（树形数据）

### 技巧4：从注释入手

**Behavior3 Editor 的关键文件都有详细注释：**

```tsx
/**
 * Explorer 组件 - 文件资源管理器
 * 
 * 职责：
 * 1. 显示工作区的文件树
 * 2. 处理文件操作
 * ...
 */
export const Explorer: FC = () => {
  /**
   * 当前选中的文件路径
   */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  
  /**
   * 打开文件
   */
  const handleOpen = (path: string) => {
    workspace.open(path);
  };
  
  // ...
};
```

**阅读方法：**
1. 先看注释，理解功能
2. 再看代码，理解实现
3. 不懂的语法跳过，不影响理解

---

## 🎉 总结

### TSX 文件的本质

```
TSX 文件 = React 组件
React 组件 = 返回 JSX 的函数
JSX = 类似 HTML 的 JavaScript 语法
TypeScript = JavaScript + 类型系统
```

### 您需要理解的

1. **JSX 语法**
   - 看起来像 HTML
   - `{}` 嵌入 JavaScript
   - 组件首字母大写

2. **组件概念**
   - 组件 = 函数
   - Props = 参数
   - 返回 JSX 描述界面

3. **数据绑定**
   - `value={data}`: 数据 → 界面
   - `onChange={fn}`: 界面 → 数据

4. **类型系统**
   - `interface`: 定义数据结构
   - `:类型`: 类型注解
   - `?`: 可选

### 您不需要深究的

- ❌ TypeScript 的高级类型（泛型、条件类型等）
- ❌ React 的底层实现（Virtual DOM、Fiber 等）
- ❌ 所有 Hook 的使用（知道常用的即可）
- ❌ 所有语法细节（遇到再查）

### 学习方法

1. **阅读时**：看注释 → 理解功能 → 看类型 → 看逻辑
2. **遇到不懂的**：查本文档速查表
3. **修改时**：参考相似代码，改动局部
4. **调试时**：用 console.log，不用担心语法

### 快速参考

**本文档包含：**
- ✅ TSX 基础语法速查
- ✅ 常见模式示例
- ✅ Behavior3 Editor 实际代码解析
- ✅ 阅读策略和技巧
- ✅ 对照表和速查卡

**下一步：**
- 打开一个 TSX 文件（如 workspace.tsx）
- 对照本文档理解代码
- 不懂的语法查速查表
- 关注数据流，不扣语法细节

祝您学习顺利！🎉

