# Zustand 状态管理详解

## 📋 什么是 Zustand？

**Zustand**（德语 "状态" 的意思，读音：/ˈtsuːʃtant/）是一个**轻量级的 React 状态管理库**。

**核心作用：** 管理和共享全局数据（状态）

**简单理解：**
```
Zustand = 一个全局的"数据仓库"
多个组件可以从这个仓库读取数据、修改数据
数据变化 → 使用数据的组件自动更新
```

---

## 🎯 为什么需要状态管理？

### 问题：组件间数据共享困难

**没有状态管理时：**

```
问题场景：
  Explorer 组件打开了文件
  ↓
  需要通知 Editor 组件加载文件
  ↓
  还需要通知 Inspector 组件显示属性
  ↓
  还需要通知 Tabs 组件切换标签页
  ↓
  如何共享数据？
```

**传统方案（Props 层层传递）：**
```tsx
<Workspace>
  ↓ props 传递
  <Explorer onFileOpen={handleOpen} />
  ↓ props 传递
  <Editor file={currentFile} />
  ↓ props 传递
  <Inspector file={currentFile} />
</Workspace>

// 问题：
// - 数据要层层传递（Props Drilling）
// - 中间组件不需要数据也要接收并传递
// - 难以维护
```

**Zustand 方案（全局状态）：**
```tsx
// 创建全局 Store
const useWorkspace = create((set) => ({
  currentFile: null,
  openFile: (file) => set({ currentFile: file }),
}));

// 各组件直接访问
const Explorer = () => {
  const openFile = useWorkspace(s => s.openFile);
  return <div onClick={() => openFile(file)}>...</div>;
};

const Editor = () => {
  const currentFile = useWorkspace(s => s.currentFile);
  return <div>{currentFile?.name}</div>;
};

const Inspector = () => {
  const currentFile = useWorkspace(s => s.currentFile);
  return <div>{currentFile?.desc}</div>;
};

// 优势：
// - 组件直接访问数据
// - 不需要层层传递
// - 维护简单
```

---

## 📖 Zustand 基础用法

### 1. 创建 Store

```typescript
import { create } from "zustand";

// 定义状态类型
interface CounterStore {
  count: number;              // 状态数据
  increment: () => void;      // 更新方法
  decrement: () => void;
}

// 创建 Store
const useCounter = create<CounterStore>((set, get) => ({
  // 初始状态
  count: 0,
  
  // 更新方法
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

**理解：**
- `create`: Zustand 的核心函数
- `set`: 更新状态的函数
- `get`: 获取当前状态的函数
- `(set, get) => ({...})`: Store 的定义函数

### 2. 使用 Store

```tsx
import { FC } from "react";

const Counter: FC = () => {
  // 订阅状态
  const { count, increment, decrement } = useCounter();
  //        ↑      ↑          ↑
  //      状态   方法      方法
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
    </div>
  );
};
```

**工作流程：**
```
用户点击 +1 按钮
  ↓
调用 increment()
  ↓
set({ count: count + 1 })
  ↓
Zustand 更新状态（count: 0 → 1）
  ↓
通知所有订阅组件
  ↓
Counter 组件重新渲染
  ↓
界面显示新的 count 值
```

### 3. 选择性订阅（性能优化）

```tsx
// 方式1：订阅全部（不推荐）
const workspace = useWorkspace();
// 任何状态变化都会触发重新渲染

// 方式2：选择性订阅（推荐）
const editing = useWorkspace(state => state.editing);
// 只有 editing 变化才会触发重新渲染

// 方式3：使用 useShallow（最佳）
import { useShallow } from "zustand/react/shallow";

const workspace = useWorkspace(
  useShallow((state) => ({
    editing: state.editing,
    open: state.open,
  }))
);
// 只有 editing 或 open 变化才会重新渲染
// useShallow 进行浅比较，避免不必要的渲染
```

**性能对比：**
```
// 订阅全部
editors 变化 → 所有订阅组件重新渲染 ✗

// 选择性订阅
editors 变化 → 只订阅了 editors 的组件重新渲染 ✓
```

---

## 🔧 在 Behavior3 Editor 中的使用

### 1. WorkspaceStore（工作区状态）

**文件位置：** `src/contexts/workspace-context.ts:559`

```typescript
import { create } from "zustand";

// 定义状态类型
export type WorkspaceStore = {
  // ========== 状态数据 ==========
  workdir: string;                    // 工作目录
  path: string;                       // 工作区文件路径
  editors: EditorStore[];             // 所有打开的编辑器
  editing?: EditorStore;              // 当前编辑器 ⭐
  fileTree?: FileTreeType;            // 文件树
  nodeDefs: NodeDefs;                 // 节点定义
  editingNode?: EditNode;             // 正在编辑的节点 ⭐
  editingTree?: EditTree;             // 正在编辑的树属性
  
  // ========== 操作方法 ==========
  init: (path: string) => void;       // 初始化工作区
  open: (path: string) => void;       // 打开文件
  edit: (path: string) => void;       // 切换编辑器
  close: (path: string) => void;      // 关闭文件
  save: () => void;                   // 保存文件
  // ... 更多方法
};

// 创建 Store
export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  // 初始状态
  workdir: "",
  editors: [],
  editing: undefined,
  fileTree: undefined,
  // ...
  
  // 方法实现
  open: (path) => {
    const workspace = get();  // 获取当前状态
    
    // 创建编辑器
    const editor = new EditorStore(path);
    workspace.editors.push(editor);
    
    // 更新状态
    set({ 
      editors: workspace.editors,
      editing: editor  // ← 触发订阅组件更新
    });
  },
  
  edit: (path) => {
    const workspace = get();
    const editor = workspace.editors.find(v => v.path === path);
    
    set({ editing: editor });  // ← 更新当前编辑器
  },
  
  // ... 其他方法
}));
```

**管理的核心状态：**
- `editing`: 当前编辑器（决定哪个标签页显示）
- `editingNode`: 当前选中的节点（决定属性面板显示）
- `editors`: 所有打开的编辑器（决定标签页列表）
- `fileTree`: 文件树（决定左侧文件列表）

### 2. SettingStore（应用设置）

**文件位置：** `src/contexts/setting-context.ts:138`

```typescript
import { create } from "zustand";

export type SettingStore = {
  // ========== 状态数据 ==========
  data: SettingModel;  // 设置数据
  
  // ========== 操作方法 ==========
  load: () => void;                        // 加载设置
  save: () => void;                        // 保存设置
  appendRecent: (path: string) => void;    // 添加最近项目
  setLayout: (layout: NodeLayout) => void; // 设置布局
  // ...
};

export const useSetting = create<SettingStore>((set, get) => ({
  // 初始状态
  data: {
    recent: [],
    layout: "compact",
    projects: [],
  },
  
  // 方法实现
  setLayout: (layout) => {
    const { data, save } = get();
    
    // 更新状态
    set({ 
      data: { ...data, layout }  // ← 不可变更新
    });
    
    // 保存到文件
    save();
    
    // 刷新界面
    useWorkspace.getState().editing?.dispatch?.("refresh");
  },
  
  // ...
}));
```

### 3. 组件中使用 Store

#### 3.1 Workspace.tsx

```tsx
import { useWorkspace } from "../contexts/workspace-context";
import { useShallow } from "zustand/react/shallow";

export const Workspace: FC = () => {
  // 订阅状态（使用 useShallow 优化）
  const workspace = useWorkspace(
    useShallow((state) => ({
      save: state.save,
      editors: state.editors,      // 订阅编辑器列表
      editing: state.editing,      // 订阅当前编辑器 ⭐
      close: state.close,
      edit: state.edit,
    }))
  );
  
  return (
    <Tabs
      activeKey={workspace.editing?.path}  {/* 使用状态 */}
      onChange={(key) => workspace.edit(key)}  {/* 调用方法 */}
      items={workspace.editors.map(...)}      {/* 使用状态 */}
    />
  );
};
```

#### 3.2 Explorer.tsx

```tsx
import { useWorkspace } from "../contexts/workspace-context";
import { useShallow } from "zustand/react/shallow";

export const Explorer: FC = () => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      fileTree: state.fileTree,    // 订阅文件树
      open: state.open,            // 订阅 open 方法
      editing: state.editing,      // 订阅当前编辑器
    }))
  );
  
  const handleSelect = (node) => {
    workspace.open(node.path);  // 调用方法更新状态
  };
  
  return (
    <DirectoryTree
      treeData={workspace.fileTree}      {/* 使用状态 */}
      selectedKeys={[workspace.editing?.path]}  {/* 使用状态 */}
      onSelect={handleSelect}
    />
  );
};
```

#### 3.3 Inspector.tsx

```tsx
import { useWorkspace } from "../contexts/workspace-context";
import { useShallow } from "zustand/react/shallow";

export const Inspector: FC = () => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      editingNode: state.editingNode,  // 订阅正在编辑的节点 ⭐
      editingTree: state.editingTree,  // 订阅正在编辑的树
    }))
  );
  
  return (
    <div>
      {/* 根据 editingNode 显示不同内容 */}
      {workspace.editingNode && (
        <Form>
          <Form.Item label="名称">
            <Input value={workspace.editingNode.data.name} />
          </Form.Item>
          {/* ... */}
        </Form>
      )}
    </div>
  );
};
```

---

## 💡 Zustand 的工作原理

### 数据流

```
用户在 Explorer 点击文件
  ↓
调用 workspace.open(path)
  ↓
Zustand Store 内部：
  ├─ 创建 EditorStore
  ├─ set({ editing: newEditor })  ← 更新状态
  └─ 通知所有订阅组件
  ↓
订阅组件自动重新渲染：
  ├─ Workspace: Tabs activeKey 变化
  ├─ Explorer: 文件高亮变化
  ├─ Editor: 加载新文件
  └─ Inspector: 显示新文件属性
  ↓
界面自动更新
```

### 状态更新机制

```typescript
// 1. 定义状态和方法
const useStore = create((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// 2. 组件订阅
const Counter = () => {
  const count = useStore(state => state.count);
  // count 变化 → 组件重新渲染
};

// 3. 调用方法更新
const Button = () => {
  const increment = useStore(state => state.increment);
  return <button onClick={increment}>+1</button>;
};

// 流程：
increment() 
  → set({ count: 1 }) 
  → Zustand 更新内部状态
  → 通知订阅了 count 的组件
  → Counter 组件重新渲染
```

---

## 📊 Zustand vs 其他状态管理

### 对比 Redux（老牌状态管理）

| 特性 | Redux | Zustand |
|-----|-------|---------|
| **代码量** | 多（需要 action、reducer） | 少（直接定义） |
| **学习成本** | 高 | 低 ⭐ |
| **样板代码** | 多 | 少 ⭐ |
| **Provider** | 需要 | 不需要 ⭐ |
| **TypeScript** | 需要配置 | 原生支持 ⭐ |
| **性能** | 好 | 好 |
| **生态** | 成熟 | 快速增长 |

### 代码量对比

**Redux 实现计数器：**
```typescript
// 1. 定义 action types
const INCREMENT = 'INCREMENT';
const DECREMENT = 'DECREMENT';

// 2. 定义 action creators
const increment = () => ({ type: INCREMENT });
const decrement = () => ({ type: DECREMENT });

// 3. 定义 reducer
const counterReducer = (state = { count: 0 }, action) => {
  switch (action.type) {
    case INCREMENT:
      return { count: state.count + 1 };
    case DECREMENT:
      return { count: state.count - 1 };
    default:
      return state;
  }
};

// 4. 创建 store
const store = createStore(counterReducer);

// 5. Provider 包裹应用
<Provider store={store}>
  <App />
</Provider>

// 6. 组件中使用
const Counter = () => {
  const count = useSelector(state => state.count);
  const dispatch = useDispatch();
  
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => dispatch(increment())}>+1</button>
    </div>
  );
};

// 总计：约 50+ 行代码
```

**Zustand 实现计数器：**
```typescript
// 1. 创建 store（包含状态和方法）
const useCounter = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// 2. 组件中使用（无需 Provider）
const Counter = () => {
  const { count, increment } = useCounter();
  
  return (
    <div>
      <p>{count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
};

// 总计：约 15 行代码
```

**节省：** 约 35 行代码，简洁 70%！

---

## 🎯 在 Behavior3 Editor 中的实际应用

### 应用1：文件打开流程

```
【Explorer 组件】
用户点击 hero.json
  ↓
调用：workspace.open("hero.json")
  ↓
【Zustand Store】
useWorkspace 内部：
  open: (path) => {
    const editor = new EditorStore(path);
    workspace.editors.push(editor);
    set({ editing: editor });  ← 更新状态
  }
  ↓
【自动通知所有订阅组件】
  ├─ Workspace 组件（订阅了 editing）
  │  └→ <Tabs activeKey={editing?.path}> 切换标签页
  ├─ Explorer 组件（订阅了 editing）
  │  └→ 高亮选中的文件
  ├─ Editor 组件（订阅了 editing）
  │  └→ useEffect 检测变化 → refreshGraph()
  └─ Inspector 组件（订阅了 editingTree）
     └→ 显示树的属性
  ↓
界面自动同步更新
```

### 应用2：节点选中流程

```
【Graph (G6画布)】
用户点击节点
  ↓
调用：workspace.onEditingNode({ data: nodeData, ... })
  ↓
【Zustand Store】
useWorkspace 内部：
  onEditingNode: (node) => {
    set({ editingNode: node });  ← 更新状态
  }
  ↓
【自动通知订阅组件】
  └─ Inspector 组件（订阅了 editingNode）
     └→ 显示节点的属性表单
     └→ 渲染参数编辑控件
  ↓
属性面板自动更新
```

### 应用3：设置更新流程

```
【Inspector 组件】
用户修改节点布局设置（compact → normal）
  ↓
调用：setting.setLayout("normal")
  ↓
【Zustand Store】
useSetting 内部：
  setLayout: (layout) => {
    set({ data: { ...data, layout } });  ← 更新状态
    save();  // 保存到文件
    workspace.editing?.dispatch?.("refresh");  // 刷新编辑器
  }
  ↓
【自动通知订阅组件】
  └─ 所有组件（订阅了 layout）
     └→ 重新渲染节点（使用新布局）
  ↓
界面自动更新
```

---

## 🔍 Zustand 核心 API

### 1. create（创建 Store）

```typescript
import { create } from "zustand";

const useStore = create<StoreType>((set, get) => ({
  // 状态和方法
}));
```

**参数：**
- `set(partial)`: 更新状态
- `get()`: 获取当前状态

**返回：**
- 一个 Hook 函数（useStore）

### 2. set（更新状态）

```typescript
// 方式1：传递对象
set({ count: 1 });

// 方式2：传递函数（基于当前状态）
set((state) => ({ count: state.count + 1 }));

// 方式3：替换整个状态
set({ count: 0, name: "New" }, true);  // 第二个参数 true = 替换

// 方式4：更新嵌套对象（不可变更新）
set((state) => ({
  user: {
    ...state.user,
    name: "New Name"
  }
}));
```

### 3. get（获取状态）

```typescript
const useStore = create((set, get) => ({
  count: 0,
  
  increment: () => {
    const current = get();  // 获取当前状态
    console.log("Current count:", current.count);
    set({ count: current.count + 1 });
  },
  
  // 跨 store 访问
  syncWithOther: () => {
    const otherStore = useOtherStore.getState();  // 获取其他 store 的状态
    set({ value: otherStore.value });
  },
}));
```

### 4. 组件中订阅

```typescript
// 订阅全部
const store = useStore();

// 选择性订阅（推荐）
const count = useStore(state => state.count);

// 订阅多个（使用 useShallow）
const { count, increment } = useStore(
  useShallow((state) => ({
    count: state.count,
    increment: state.increment,
  }))
);
```

---

## 🚀 Zustand 的优势

### 1. API 简洁

```typescript
// Zustand：3 行代码
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Redux：30+ 行代码（action、reducer、store等）
```

### 2. 无需 Provider

```tsx
// Redux：需要 Provider 包裹
<Provider store={store}>
  <App />
</Provider>

// Zustand：直接使用（无需 Provider）
<App />
```

### 3. TypeScript 支持好

```typescript
// 完整的类型推导
const useStore = create<StoreType>((set, get) => ({
  // TypeScript 会检查类型
}));

// 组件中自动推导类型
const count = useStore(state => state.count);
//    ↑ 类型：number（自动推导）
```

### 4. 性能优秀

```typescript
// 自动优化：只更新变化的部分
set({ count: 1 });  // 只有 count 变化的组件重新渲染

// 配合 useShallow 进一步优化
const store = useStore(useShallow(...));
```

### 5. 中间件支持

```typescript
import { persist } from "zustand/middleware";

// 持久化中间件（自动保存到 localStorage）
const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    { name: "my-store" }  // localStorage 的 key
  )
);
```

---

## 📝 常见模式

### 模式1：状态分离

```typescript
// 将状态分成多个 Store
const useWorkspace = create(...);  // 工作区状态
const useSetting = create(...);    // 设置状态
const useUI = create(...);         // UI 状态

// 各司其职，互不干扰
```

### 模式2：异步操作

```typescript
const useStore = create((set) => ({
  data: null,
  loading: false,
  
  fetchData: async () => {
    set({ loading: true });
    
    try {
      const data = await fetch("/api/data");
      set({ data, loading: false });
    } catch (error) {
      set({ loading: false, error });
    }
  },
}));
```

### 模式3：计算属性（派生状态）

```typescript
const useStore = create((set, get) => ({
  editors: [],
  
  // 计算属性：通过 get() 实时计算
  get hasUnsaved() {
    return get().editors.some(e => e.changed);
  },
}));

// 组件中使用
const hasUnsaved = useStore(state => state.hasUnsaved);
```

### 模式4：跨 Store 访问

```typescript
// Store A
const useWorkspace = create((set) => ({
  editing: null,
  open: (path) => {
    // 访问 Store B
    const layout = useSetting.getState().data.layout;
    // ...
  },
}));

// Store B
const useSetting = create((set) => ({
  data: { layout: "compact" },
}));
```

---

## 🔧 性能优化

### 1. useShallow（浅比较）

```tsx
// 问题：每次渲染都创建新对象
const workspace = useWorkspace((state) => ({
  editing: state.editing,
  open: state.open,
}));
// 即使 editing 和 open 没变，对象引用也变了 → 不必要的重新渲染

// 解决：使用 useShallow
import { useShallow } from "zustand/react/shallow";

const workspace = useWorkspace(
  useShallow((state) => ({
    editing: state.editing,
    open: state.open,
  }))
);
// useShallow 进行浅比较，只有值变化才重新渲染 ✓
```

### 2. 选择性订阅

```tsx
// 不好：订阅全部
const workspace = useWorkspace();
// 任何状态变化都会触发重新渲染 ✗

// 好：只订阅需要的
const editing = useWorkspace(state => state.editing);
// 只有 editing 变化才重新渲染 ✓

// 更好：使用 useShallow 订阅多个
const workspace = useWorkspace(
  useShallow((state) => ({
    editing: state.editing,
    open: state.open,
  }))
);
// 只有 editing 或 open 变化才重新渲染 ✓
```

### 3. 避免在渲染函数中创建对象

```tsx
// 不好
const workspace = useWorkspace((state) => ({
  editing: state.editing,
  editors: state.editors.filter(e => !e.changed),  // 每次都创建新数组 ✗
}));

// 好
const editing = useWorkspace(state => state.editing);
const unsavedEditors = useWorkspace(
  state => state.editors.filter(e => e.changed)
);
// 或使用 useMemo 缓存
```

---

## 📁 Zustand 相关文件

### 定义位置

```
src/contexts/workspace-context.ts:559    useWorkspace Store
src/contexts/setting-context.ts:138      useSetting Store
```

### 使用位置

```
所有组件都可以使用：

src/components/workspace.tsx       订阅 editing, editors
src/components/explorer.tsx        订阅 fileTree, editing, open
src/components/editor.tsx          订阅 editing
src/components/inspector.tsx       订阅 editingNode, editingTree
src/components/titlebar.tsx        订阅 editing
src/components/menu.tsx            订阅工作区方法
```

### 依赖

```json
// package.json
{
  "dependencies": {
    "zustand": "^5.0.3"  // Zustand 核心库
  }
}
```

---

## 💡 Zustand 核心概念

### 1. Store（仓库）

```
Store = 一个全局的数据仓库

包含：
  - 状态数据（state）
  - 更新方法（actions）

特点：
  - 全局唯一
  - 所有组件共享
  - 响应式（数据变化 → 组件更新）
```

### 2. Selector（选择器）

```typescript
// Selector 函数：从 store 中选择数据
const editing = useWorkspace(
  (state) => state.editing  // ← Selector 函数
);

// 作用：
// - 选择需要的数据
// - 优化性能（只订阅选中的数据）
```

### 3. 不可变更新（Immutable Update）

```typescript
// 错误：直接修改状态 ✗
set((state) => {
  state.count++;  // ✗ 直接修改
  return state;
});

// 正确：创建新对象 ✓
set((state) => ({
  count: state.count + 1  // ✓ 返回新对象
}));

// 更新嵌套对象
set((state) => ({
  user: {
    ...state.user,      // 展开原对象
    name: "New Name"    // 覆盖属性
  }
}));
```

---

## 🎓 学习 Zustand 的路径

### 最小必要知识

**您只需要理解这些：**

1. **什么是 Store？**
   - 全局数据仓库
   - 包含状态和方法

2. **如何创建 Store？**
   ```typescript
   const useStore = create((set) => ({
     data: initialValue,
     update: () => set({ data: newValue }),
   }));
   ```

3. **如何使用 Store？**
   ```typescript
   const data = useStore(state => state.data);
   const update = useStore(state => state.update);
   ```

4. **数据变化如何触发更新？**
   ```
   set({ data: newValue })
     ↓
   Zustand 更新状态
     ↓
   订阅组件自动重新渲染
   ```

**不需要深入：**
- ❌ Zustand 的底层实现
- ❌ 中间件系统（persist、devtools等）
- ❌ 高级用法（subscribeWithSelector等）

### 学习方法

**从实际代码理解：**

```typescript
// 1. 打开 workspace-context.ts
// 2. 找到 useWorkspace = create(...)
// 3. 看初始状态（editors: [], editing: undefined等）
// 4. 看方法实现（open, edit, close等）
// 5. 理解 set 如何更新状态

// 6. 打开 workspace.tsx
// 7. 看如何订阅状态（useWorkspace(useShallow(...))）
// 8. 理解如何使用状态（workspace.editing?.path）
// 9. 理解如何调用方法（workspace.open(path)）
```

---

## 📊 Zustand 在项目中的数据流图

```
┌─────────────────────────────────────────────┐
│          Zustand Store (数据中心)             │
├─────────────────────────────────────────────┤
│                                             │
│  useWorkspace Store:                        │
│  ├─ workdir: string                         │
│  ├─ editors: EditorStore[]                  │
│  ├─ editing: EditorStore ← 当前编辑器         │
│  ├─ fileTree: FileTreeType                  │
│  ├─ editingNode: EditNode ← 当前节点         │
│  └─ 方法: open, edit, close, save...        │
│                                             │
│  useSetting Store:                          │
│  ├─ recent: string[]                        │
│  ├─ layout: "compact" | "normal"            │
│  └─ 方法: load, save, setLayout...          │
│                                             │
└─────────────────────────────────────────────┘
         ↕ 订阅和更新
┌─────────────────────────────────────────────┐
│             React 组件层                     │
├─────────────────────────────────────────────┤
│                                             │
│  Workspace.tsx                              │
│    ← 订阅: editing, editors                 │
│    → 显示: Tabs activeKey={editing?.path}   │
│                                             │
│  Explorer.tsx                               │
│    ← 订阅: fileTree, editing                │
│    → 调用: workspace.open(path)             │
│                                             │
│  Editor.tsx                                 │
│    ← 订阅: editing                          │
│    → 响应: useEffect(..., [editing])        │
│                                             │
│  Inspector.tsx                              │
│    ← 订阅: editingNode, editingTree         │
│    → 显示: 节点/树属性                       │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🎉 总结

### Zustand 是什么？

**简单答案：**
```
Zustand = React 的状态管理库
作用 = 管理和共享全局数据
```

### Zustand 的核心价值

1. **简化数据共享**
   - 不需要 Props 层层传递
   - 组件直接访问全局状态

2. **自动更新界面**
   - 状态变化 → 订阅组件自动重新渲染
   - 不需要手动刷新

3. **简洁的 API**
   - 比 Redux 简单 70%
   - 无需 Provider
   - TypeScript 支持好

### 在 Behavior3 Editor 中

**管理两个核心 Store：**
1. **WorkspaceStore**：工作区状态（编辑器、文件、节点）
2. **SettingStore**：应用设置（最近项目、布局）

**数据流：**
```
用户操作
  ↓
调用 Store 方法（workspace.open）
  ↓
更新状态（set）
  ↓
Zustand 通知订阅组件
  ↓
组件自动重新渲染
  ↓
界面更新
```

### 学习建议

**对于不熟悉前端的读者：**
- ✅ 理解 Store = 全局数据仓库
- ✅ 理解 set = 更新数据
- ✅ 理解订阅 = 组件使用数据
- ✅ 理解数据流：操作 → 更新 → 通知 → 渲染
- ❌ 不用深究底层实现

**记住：**
```
Zustand 让组件间的数据共享变简单了！
```

---

## 📚 扩展资源

### 官方文档
- GitHub: https://github.com/pmndrs/zustand
- 文档: https://docs.pmnd.rs/zustand/getting-started/introduction

### 学习重点
- 基础用法（create、set、get）
- 在组件中使用（useStore、useShallow）
- 性能优化（选择性订阅）

### 可选学习
- 中间件（persist、devtools）
- 高级用法（subscribeWithSelector）
- 与其他状态管理库的对比

### 替代方案
- Redux: 老牌，功能强大，复杂
- MobX: 响应式，简单，学习曲线平缓
- Jotai: 原子化状态，现代
- Recoil: Facebook 出品，原子化

**Behavior3 Editor 选择 Zustand：**
- 简洁（API 简单）
- 轻量（体积小）
- 高效（性能好）
- TypeScript 支持完善

