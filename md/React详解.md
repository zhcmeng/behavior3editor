# React 详解

## 📋 目录

1. [什么是 React](#什么是-react)
2. [核心概念](#核心概念)
3. [组件系统](#组件系统)
4. [Hooks 详解](#hooks-详解)
5. [状态管理](#状态管理)
6. [本项目中的 React](#本项目中的-react)
7. [性能优化](#性能优化)
8. [常见模式](#常见模式)

---

## 🎯 什么是 React？

### 基本定义

**React** 是一个用于构建用户界面的 **JavaScript 库**，由 Facebook（Meta）开发和维护。

```
┌─────────────────────────────────────────────────────────┐
│                    React 是什么？                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ❌ 不是框架（不像 Angular）                            │
│  ✅ 是 UI 库（专注于视图层）                            │
│                                                         │
│  核心理念：                                              │
│  ├─ 组件化（Component-Based）                          │
│  ├─ 声明式（Declarative）                              │
│  └─ 虚拟 DOM（Virtual DOM）                            │
│                                                         │
│  技术栈位置：                                            │
│  Chromium (浏览器) → JavaScript (语言) → React (UI库)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### React 的特点

#### 1. 组件化（Component-Based）

将 UI 拆分成独立、可复用的组件：

```tsx
// 传统 HTML + JavaScript
<div id="app"></div>
<script>
  document.getElementById('app').innerHTML = '<button>Click</button>';
</script>

// React 方式
function Button() {
  return <button>Click</button>;
}

function App() {
  return (
    <div>
      <Button />
      <Button />
      <Button />
    </div>
  );
}
```

#### 2. 声明式（Declarative）

描述 UI "应该是什么样"，而不是"如何变成那样"：

```tsx
// 命令式（Imperative）- 传统 JavaScript
const button = document.createElement('button');
button.textContent = 'Click Me';
button.onclick = () => {
  button.textContent = 'Clicked!';
};
document.body.appendChild(button);

// 声明式（Declarative）- React
function Button() {
  const [clicked, setClicked] = useState(false);
  
  return (
    <button onClick={() => setClicked(true)}>
      {clicked ? 'Clicked!' : 'Click Me'}
    </button>
  );
}
```

#### 3. 虚拟 DOM（Virtual DOM）

React 在内存中维护一个轻量级的 DOM 副本：

```
┌────────────────────────────────────────────────────────┐
│              虚拟 DOM 工作原理                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. 状态改变                                            │
│     count: 0 → 1                                       │
│                                                        │
│  2. 创建新的虚拟 DOM                                    │
│     Virtual DOM Tree (新)                              │
│                                                        │
│  3. Diff 算法比较                                       │
│     Virtual DOM (旧) vs Virtual DOM (新)               │
│     找出最小差异                                        │
│                                                        │
│  4. 更新真实 DOM                                        │
│     只更新变化的部分                                    │
│     <span>0</span> → <span>1</span>                    │
│                                                        │
│  优势：                                                 │
│  ✅ 批量更新（性能好）                                  │
│  ✅ 跨平台（React Native）                             │
│  ✅ 时间旅行（调试工具）                                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 🧩 核心概念

### 1. JSX - JavaScript XML

JSX 是 JavaScript 的语法扩展，允许在 JavaScript 中写类似 HTML 的代码：

```tsx
// JSX（看起来像 HTML）
const element = <h1 className="title">Hello, React!</h1>;

// 编译后的 JavaScript
const element = React.createElement(
  'h1',
  { className: 'title' },
  'Hello, React!'
);
```

**JSX 规则**：

```tsx
// 1. 必须有一个根元素
function App() {
  return (
    <div>  {/* 根元素 */}
      <h1>Title</h1>
      <p>Content</p>
    </div>
  );
}

// 或使用 Fragment
function App() {
  return (
    <>  {/* Fragment 不会创建额外 DOM 节点 */}
      <h1>Title</h1>
      <p>Content</p>
    </>
  );
}

// 2. 标签必须闭合
<img src="image.jpg" />  {/* 自闭合 */}
<div></div>              {/* 显式闭合 */}

// 3. 使用 className 而不是 class
<div className="container">  {/* ✅ 正确 */}
<div class="container">      {/* ❌ 错误 */}

// 4. 使用驼峰命名
<button onClick={handleClick}>  {/* ✅ 正确 */}
<button onclick={handleClick}>  {/* ❌ 错误 */}

// 5. JavaScript 表达式用 {}
const name = "World";
<h1>Hello, {name}!</h1>
<p>{1 + 1}</p>
<div className={isActive ? 'active' : 'inactive'}></div>
```

---

### 2. 组件（Components）

组件是 React 应用的构建块。

#### 函数组件（Function Component）- 现代推荐

```tsx
// 简单组件
function Welcome() {
  return <h1>Hello, World!</h1>;
}

// 带 Props 的组件
interface WelcomeProps {
  name: string;
  age?: number;  // 可选属性
}

function Welcome({ name, age }: WelcomeProps) {
  return (
    <div>
      <h1>Hello, {name}!</h1>
      {age && <p>Age: {age}</p>}
    </div>
  );
}

// 使用组件
<Welcome name="Alice" age={25} />
```

#### 类组件（Class Component）- 旧式写法

```tsx
class Welcome extends React.Component<WelcomeProps> {
  render() {
    return <h1>Hello, {this.props.name}!</h1>;
  }
}
```

**函数组件 vs 类组件**：

| 特性 | 函数组件 | 类组件 |
|-----|---------|--------|
| 语法 | 简洁 | 繁琐 |
| Hooks | ✅ 支持 | ❌ 不支持 |
| 性能 | 稍好 | 稍差 |
| 推荐度 | ✅ 现代推荐 | ❌ 逐渐淘汰 |

---

### 3. Props - 属性传递

Props 是组件之间传递数据的方式（单向数据流）：

```tsx
// 父组件传递数据给子组件
function Parent() {
  const user = { name: 'Alice', age: 25 };
  
  return (
    <Child 
      name={user.name} 
      age={user.age}
      onSave={(data) => console.log(data)}
    />
  );
}

// 子组件接收 Props
interface ChildProps {
  name: string;
  age: number;
  onSave: (data: any) => void;
}

function Child({ name, age, onSave }: ChildProps) {
  return (
    <div>
      <p>{name} - {age}</p>
      <button onClick={() => onSave({ name, age })}>
        Save
      </button>
    </div>
  );
}
```

**Props 的特点**：
- ✅ 只读（不能修改）
- ✅ 单向流动（父 → 子）
- ✅ 任何类型（字符串、数字、对象、函数等）

---

### 4. State - 组件状态

State 是组件的私有数据，可以改变：

```tsx
import { useState } from 'react';

function Counter() {
  // 声明状态变量
  const [count, setCount] = useState(0);
  //     ↑状态值  ↑更新函数    ↑初始值
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  );
}
```

**State vs Props**：

| 特性 | State | Props |
|-----|-------|-------|
| 可变性 | ✅ 可变 | ❌ 只读 |
| 来源 | 组件内部 | 父组件传递 |
| 作用域 | 本组件 | 接收组件 |
| 更新 | setState | 父组件重新渲染 |

---

## 🎣 Hooks 详解

Hooks 是 React 16.8 引入的新特性，让函数组件也能使用状态和其他 React 特性。

### 1. useState - 状态管理

```tsx
import { useState } from 'react';

function Example() {
  // 基础用法
  const [count, setCount] = useState(0);
  
  // 对象状态
  const [user, setUser] = useState({ name: '', age: 0 });
  
  // 数组状态
  const [items, setItems] = useState<string[]>([]);
  
  // 函数式更新（基于前一个状态）
  const increment = () => {
    setCount(prevCount => prevCount + 1);
  };
  
  // 更新对象（保留其他属性）
  const updateName = (name: string) => {
    setUser(prev => ({ ...prev, name }));
  };
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+1</button>
      
      <p>User: {user.name}</p>
      <input 
        value={user.name}
        onChange={(e) => updateName(e.target.value)}
      />
    </div>
  );
}
```

---

### 2. useEffect - 副作用处理

```tsx
import { useEffect, useState } from 'react';

function Example() {
  const [data, setData] = useState(null);
  const [count, setCount] = useState(0);
  
  // 1. 每次渲染都执行（不推荐）
  useEffect(() => {
    console.log('每次渲染');
  });
  
  // 2. 只在挂载时执行一次
  useEffect(() => {
    console.log('组件挂载');
    
    // 清理函数（组件卸载时执行）
    return () => {
      console.log('组件卸载');
    };
  }, []); // 空依赖数组
  
  // 3. 依赖变化时执行
  useEffect(() => {
    console.log('count 变化:', count);
    
    // 异步操作
    fetchData(count).then(result => {
      setData(result);
    });
  }, [count]); // 依赖 count
  
  return <div>{data}</div>;
}
```

**useEffect 时机**：

```
组件生命周期
├── 1. 挂载 (Mount)
│   └── useEffect(() => {}, [])
│
├── 2. 更新 (Update)
│   └── useEffect(() => {}, [dep])
│
└── 3. 卸载 (Unmount)
    └── useEffect(() => {
        return () => { /* 清理 */ }
    }, [])
```

---

### 3. useRef - 引用值

```tsx
import { useRef, useEffect } from 'react';

function TextInput() {
  // 1. DOM 引用
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // 聚焦输入框
    inputRef.current?.focus();
  }, []);
  
  // 2. 保存不触发重新渲染的值
  const countRef = useRef(0);
  
  const handleClick = () => {
    countRef.current += 1;
    console.log(countRef.current); // 不会触发重新渲染
  };
  
  return (
    <div>
      <input ref={inputRef} />
      <button onClick={handleClick}>Click</button>
    </div>
  );
}
```

**useRef vs useState**：

| 特性 | useRef | useState |
|-----|--------|----------|
| 改变时重新渲染 | ❌ 不会 | ✅ 会 |
| 用途 | DOM 引用、缓存值 | UI 状态 |
| 访问方式 | `.current` | 直接访问 |

---

### 4. useCallback - 函数缓存

```tsx
import { useCallback, useState } from 'react';

function Parent() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');
  
  // ❌ 每次渲染都创建新函数
  const handleClick = () => {
    console.log(count);
  };
  
  // ✅ 缓存函数，只在 count 变化时重新创建
  const handleClickMemo = useCallback(() => {
    console.log(count);
  }, [count]);
  
  return (
    <div>
      <Child onClick={handleClickMemo} />
      <input value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

// 子组件使用 memo 优化
const Child = memo(({ onClick }: { onClick: () => void }) => {
  console.log('Child 渲染');
  return <button onClick={onClick}>Click</button>;
});
```

---

### 5. useMemo - 值缓存

```tsx
import { useMemo, useState } from 'react';

function ExpensiveComponent() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');
  
  // ❌ 每次渲染都计算
  const expensiveValue = computeExpensiveValue(count);
  
  // ✅ 缓存计算结果
  const memoizedValue = useMemo(() => {
    console.log('计算中...');
    return computeExpensiveValue(count);
  }, [count]); // 只在 count 变化时重新计算
  
  return (
    <div>
      <p>Result: {memoizedValue}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <input value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

function computeExpensiveValue(num: number) {
  // 昂贵的计算
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += num;
  }
  return result;
}
```

---

### 6. useContext - 上下文共享

```tsx
import { createContext, useContext, useState } from 'react';

// 1. 创建 Context
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// 2. 提供 Context
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 3. 消费 Context（任意深度的子组件）
function ThemedButton() {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  
  return (
    <button 
      style={{ 
        background: context.theme === 'light' ? '#fff' : '#000',
        color: context.theme === 'light' ? '#000' : '#fff'
      }}
      onClick={context.toggleTheme}
    >
      Toggle Theme
    </button>
  );
}
```

**Context 的用途**：
- ✅ 主题配置
- ✅ 用户信息
- ✅ 语言设置
- ✅ 全局状态

---

## 🗂️ 状态管理

### 本项目使用 Zustand

```tsx
// src/contexts/workspace-context.ts
import { create } from 'zustand';

interface WorkspaceState {
  // 状态
  workdir: string;
  trees: TreeData[];
  currentTree: TreeData | null;
  
  // 操作
  openWorkspace: (path: string) => void;
  saveTree: () => void;
  addNode: (node: NodeData) => void;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  // 初始状态
  workdir: '',
  trees: [],
  currentTree: null,
  
  // 操作实现
  openWorkspace: (path) => {
    // 读取工作区
    const trees = loadTrees(path);
    set({ workdir: path, trees });
  },
  
  saveTree: () => {
    const { currentTree } = get();
    if (currentTree) {
      saveToFile(currentTree);
    }
  },
  
  addNode: (node) => {
    set((state) => ({
      currentTree: {
        ...state.currentTree!,
        nodes: [...state.currentTree!.nodes, node]
      }
    }));
  },
}));

// 在组件中使用
function Editor() {
  const { currentTree, addNode } = useWorkspace();
  
  return (
    <div>
      <button onClick={() => addNode(newNode)}>
        Add Node
      </button>
    </div>
  );
}
```

**状态管理方案对比**：

| 方案 | 复杂度 | 性能 | 使用场景 |
|-----|-------|------|---------|
| useState | 简单 | 好 | 单组件状态 |
| useContext | 中等 | 中等 | 跨组件共享 |
| Zustand | 简单 | 好 | 全局状态（本项目） |
| Redux | 复杂 | 好 | 大型应用 |
| MobX | 中等 | 好 | 复杂状态逻辑 |

---

## 💻 本项目中的 React

### 1. 项目入口

```tsx
// src/main.tsx
import ReactDOM from "react-dom/client";

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
```

**组件层次**：

```
<React.StrictMode>          # 开发模式检查
  <ConfigProvider>          # Ant Design 主题配置
    <App>                   # Ant Design App 容器
      <Setup />             # 初始化设置
      <Workspace />         # 主工作区
        ├── <TitleBar />    # 标题栏
        ├── <Menu />        # 菜单栏
        ├── <Explorer />    # 文件浏览器
        ├── <Editor />      # 编辑器（核心）
        └── <Inspector />   # 属性检查器
```

---

### 2. Workspace 组件（主工作区）

```tsx
// src/components/workspace.tsx
export const Workspace: FC = () => {
  // 1. 使用 Zustand 状态管理
  const workspace = useWorkspace(
    useShallow((state) => ({
      save: state.save,
      editors: state.editors,
      openProject: state.openProject,
      // ... 更多状态和方法
    }))
  );
  
  // 2. 使用 Hooks
  const [activeTab, setActiveTab] = useState<string>();
  const forceUpdate = useForceUpdate();
  const windowSize = useWindowSize();
  const { t } = useTranslation();
  
  // 3. 快捷键处理
  useKeyPress(Hotkey.Save, () => workspace.save());
  useKeyPress(Hotkey.Copy, () => handleEdit("copy"));
  
  // 4. 效果
  useEffect(() => {
    // 监听文件变化
    const interval = setInterval(() => {
      workspace.checkFileChanges();
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // 5. 渲染 UI
  return (
    <Layout style={{ height: "100vh" }}>
      <TitleBar />
      <Header>
        <Menu />
      </Header>
      <Layout>
        <Sider width={240}>
          <Explorer />
        </Sider>
        <Content>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={workspace.editors.map(editor => ({
              key: editor.path,
              label: <TabLabel editor={editor} />,
              children: <Editor editor={editor} />
            }))}
          />
        </Content>
        <Sider width={300}>
          <Inspector />
        </Sider>
      </Layout>
    </Layout>
  );
};
```

---

### 3. 组件通信模式

#### 父子通信（Props）

```tsx
// 父组件
function Workspace() {
  const [tree, setTree] = useState(treeData);
  
  return (
    <Editor 
      tree={tree}
      onNodeClick={(node) => console.log(node)}
      onTreeChange={(newTree) => setTree(newTree)}
    />
  );
}

// 子组件
interface EditorProps {
  tree: TreeData;
  onNodeClick: (node: NodeData) => void;
  onTreeChange: (tree: TreeData) => void;
}

function Editor({ tree, onNodeClick, onTreeChange }: EditorProps) {
  return (
    <div>
      {tree.nodes.map(node => (
        <Node 
          key={node.id} 
          data={node}
          onClick={() => onNodeClick(node)}
        />
      ))}
    </div>
  );
}
```

#### 全局状态（Zustand）

```tsx
// 任何组件都可以访问
function AnyComponent() {
  const { currentTree, addNode } = useWorkspace();
  
  return (
    <button onClick={() => addNode(newNode)}>
      Add Node
    </button>
  );
}
```

---

### 4. 常用 Hooks（本项目）

```tsx
// 1. useForceUpdate - 强制重新渲染
import useForceUpdate from 'use-force-update';

function Component() {
  const forceUpdate = useForceUpdate();
  
  // 某些情况下需要强制刷新
  const handleRefresh = () => {
    forceUpdate();
  };
}

// 2. useWindowSize - 窗口大小
import { useWindowSize } from 'usehooks-ts';

function Component() {
  const { width, height } = useWindowSize();
  
  return <div>Window: {width} x {height}</div>;
}

// 3. useTranslation - 国际化
import { useTranslation } from 'react-i18next';

function Component() {
  const { t } = useTranslation();
  
  return <button>{t('save')}</button>;
}

// 4. useShallow - Zustand 浅比较
import { useShallow } from 'zustand/react/shallow';

function Component() {
  const workspace = useWorkspace(
    useShallow((state) => ({
      trees: state.trees,
      save: state.save
    }))
  );
}
```

---

## ⚡ 性能优化

### 1. React.memo - 组件缓存

```tsx
import { memo } from 'react';

// ❌ 每次父组件渲染都会重新渲染
function ExpensiveComponent({ data }: { data: any }) {
  console.log('渲染');
  return <div>{/* 复杂的渲染逻辑 */}</div>;
}

// ✅ 只在 props 变化时重新渲染
const ExpensiveComponentMemo = memo(function ExpensiveComponent({ data }) {
  console.log('渲染');
  return <div>{/* 复杂的渲染逻辑 */}</div>;
});
```

---

### 2. 虚拟列表 - 大量数据渲染

```tsx
// 问题：渲染 10000 个项目
function SlowList() {
  const items = Array.from({ length: 10000 }, (_, i) => i);
  
  return (
    <div>
      {items.map(item => (
        <div key={item}>{item}</div>  // 渲染 10000 个 div
      ))}
    </div>
  );
}

// 解决：只渲染可见的项目
import { FixedSizeList } from 'react-window';

function FastList() {
  return (
    <FixedSizeList
      height={500}      // 容器高度
      itemCount={10000} // 总项目数
      itemSize={35}     // 每项高度
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>Item {index}</div>  // 只渲染可见的
      )}
    </FixedSizeList>
  );
}
```

---

### 3. 代码分割 - 按需加载

```tsx
import { lazy, Suspense } from 'react';

// ❌ 同步导入（打包时全部加载）
import HeavyComponent from './HeavyComponent';

// ✅ 异步导入（使用时才加载）
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

---

### 4. 避免不必要的重新渲染

```tsx
// ❌ 每次都创建新对象/数组
function Bad() {
  const [count, setCount] = useState(0);
  
  return (
    <Child 
      config={{ theme: 'dark' }}  // 新对象
      items={[1, 2, 3]}           // 新数组
      onClick={() => console.log('click')}  // 新函数
    />
  );
}

// ✅ 使用 memo 化
function Good() {
  const [count, setCount] = useState(0);
  
  const config = useMemo(() => ({ theme: 'dark' }), []);
  const items = useMemo(() => [1, 2, 3], []);
  const onClick = useCallback(() => console.log('click'), []);
  
  return <Child config={config} items={items} onClick={onClick} />;
}
```

---

## 🎨 常见模式

### 1. 条件渲染

```tsx
function Component({ isLoggedIn, user }: { isLoggedIn: boolean, user?: User }) {
  // 模式 1: if 语句
  if (!isLoggedIn) {
    return <Login />;
  }
  
  // 模式 2: 三元运算符
  return (
    <div>
      {isLoggedIn ? <Dashboard /> : <Login />}
    </div>
  );
  
  // 模式 3: && 运算符
  return (
    <div>
      {isLoggedIn && <Dashboard />}
      {user && <UserProfile user={user} />}
    </div>
  );
  
  // 模式 4: 可选链
  return (
    <div>
      {user?.name}
    </div>
  );
}
```

---

### 2. 列表渲染

```tsx
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>  {/* key 很重要！ */}
          <input 
            type="checkbox" 
            checked={todo.completed}
          />
          <span>{todo.text}</span>
        </li>
      ))}
    </ul>
  );
}
```

**为什么需要 key？**

```tsx
// ❌ 没有 key
[
  <div>Item 1</div>,
  <div>Item 2</div>,
  <div>Item 3</div>
]

// 删除 Item 2 后
[
  <div>Item 1</div>,
  <div>Item 3</div>  // React 不知道这是原来的 Item 3
]

// ✅ 有 key
[
  <div key="1">Item 1</div>,
  <div key="2">Item 2</div>,
  <div key="3">Item 3</div>
]

// 删除 Item 2 后
[
  <div key="1">Item 1</div>,
  <div key="3">Item 3</div>  // React 知道保留 key="3" 的元素
]
```

---

### 3. 表单处理

```tsx
function Form() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: 0
  });
  
  // 受控组件
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('提交:', formData);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={formData.name}
        onChange={handleChange}
        placeholder="姓名"
      />
      <input
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="邮箱"
      />
      <input
        name="age"
        type="number"
        value={formData.age}
        onChange={handleChange}
        placeholder="年龄"
      />
      <button type="submit">提交</button>
    </form>
  );
}
```

---

### 4. 错误边界

```tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('错误:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>出错了！</h1>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// 使用
function App() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

---

## 📊 React 渲染流程

```
┌────────────────────────────────────────────────────────┐
│             React 完整渲染流程                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. JSX 代码                                           │
│     <div>Hello</div>                                  │
│     ↓                                                  │
│                                                        │
│  2. Babel 转译                                         │
│     React.createElement('div', null, 'Hello')         │
│     ↓                                                  │
│                                                        │
│  3. 创建虚拟 DOM                                       │
│     { type: 'div', props: { children: 'Hello' } }    │
│     ↓                                                  │
│                                                        │
│  4. Reconciliation（协调）                            │
│     比较新旧虚拟 DOM，找出差异                         │
│     ↓                                                  │
│                                                        │
│  5. Commit（提交）                                     │
│     将变化应用到真实 DOM                               │
│     ↓                                                  │
│                                                        │
│  6. Chromium 渲染                                      │
│     Blink 渲染引擎显示到屏幕                           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 🎓 总结

### React 核心要点

1. **组件化**
   - UI 拆分成独立组件
   - 可复用、可维护

2. **声明式**
   - 描述 UI 应该是什么样
   - React 负责如何更新

3. **虚拟 DOM**
   - 内存中的 DOM 副本
   - Diff 算法找出最小变化
   - 批量更新真实 DOM

4. **Hooks**
   - `useState` - 状态
   - `useEffect` - 副作用
   - `useCallback` - 函数缓存
   - `useMemo` - 值缓存
   - `useContext` - 上下文

5. **性能优化**
   - React.memo
   - useCallback/useMemo
   - 虚拟列表
   - 代码分割

### 本项目技术栈

```
Behavior3Editor
├── Electron（框架）
│   ├── Node.js（后端）
│   └── Chromium（浏览器）
├── React（UI 库）← 你现在理解的
│   ├── 组件化
│   ├── Hooks
│   └── 状态管理（Zustand）
├── TypeScript（类型）
├── Ant Design（UI 组件）
├── G6（图形库）
└── Vite（构建工具）
```

### React 的位置

```
用户界面层次
├── Chromium（浏览器引擎）
│   ├── Blink（渲染引擎）
│   └── V8（JS 引擎）
├── React（UI 库）← 运行在 Chromium 中
│   └── 虚拟 DOM → Chromium DOM
└── Ant Design（UI 组件库）
    └── 基于 React 构建
```

---

## 🔗 相关资源

- [React 官方文档](https://react.dev/)
- [React TypeScript 备忘单](https://react-typescript-cheatsheet.netlify.app/)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [Ant Design 文档](https://ant.design/)
- [React DevTools](https://react.dev/learn/react-developer-tools)

现在你应该完全理解 React 在这个项目中的作用了！它负责将数据转换为用户界面，让编辑器可以方便地展示和交互。🎉

