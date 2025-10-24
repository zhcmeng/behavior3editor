# TreeVar 变量类型扩展方案

## 概述

本文档详细描述了扩展现有 `VarDecl` 接口以支持变量类型和值的修改方案。该方案采用向后兼容的方式，为行为树变量系统添加类型化支持。

## 设计目标

1. **类型明确**：为变量添加明确的类型定义
2. **向后兼容**：保持与现有系统的兼容性
3. **功能完整**：支持常量、对象变量、配置参数、代码表达式四种类型
4. **易于扩展**：为未来的功能扩展预留空间

## 核心设计

### 新增类型定义

```typescript
export const enum VarType {
  /** 常量 */
  CONST_VAR = "const_var",
  /** 对象变量 */
  OBJECT_VAR = "object_var", 
  /** 配置参数 */
  CFG_VAR = "cfg_var",
  /** 代码表达式 */
  CODE_VAR = "code_var",
}

export interface VarDecl {
  /** 变量名 */
  name: string;
  /** 变量描述 */
  desc: string;
  /** 变量类型（可选，保持向后兼容） */
  type?: VarType;
  /** 变量值（可选，保持向后兼容） */
  value?: unknown;
}
```

## 详细修改清单

### 1. 核心类型定义修改

#### 📁 `src/misc/b3type.ts` (第455行)

**修改前：**
```typescript
export interface VarDecl {
  name: string;
  desc: string;
}
```

**修改后：**
```typescript
export interface VarDecl {
  name: string;
  desc: string;
  type?: VarType;     // 新增：变量类型（可选，保持向后兼容）
  value?: unknown;        // 新增：变量值（可选，保持向后兼容）
}

// 新增枚举定义
export const enum VarType {
  /** 常量 */
  CONST_VAR = "const_var",
  /** 对象变量 */
  OBJECT_VAR = "object_var", 
  /** 配置参数 */
  CFG_VAR = "cfg_var",
  /** 代码表达式 */
  CODE_VAR = "code_var",
}
```

**修改说明：**
- 添加可选的 `type` 字段，使用枚举类型确保类型安全
- 添加可选的 `value` 字段，支持任意类型的值
- 使用可选字段保持向后兼容性

### 2. 工具函数修改

#### 📁 `src/misc/b3util.ts`

##### 2.1 updateUsingVars 函数 (第130行)

**修改前：**
```typescript
export const updateUsingVars = (vars: VarDecl[]) => {
  usingVars = null;
  for (const v of vars) {
    usingVars ??= {};
    usingVars[v.name] = v;
  }
};
```

**修改后：**
```typescript
export const updateUsingVars = (vars: VarDecl[]) => {
  usingVars = null;
  for (const v of vars) {
    usingVars ??= {};
    // 确保变量包含完整的类型信息
    usingVars[v.name] = {
      name: v.name,
      desc: v.desc,
      type: v.type || VarType.OBJECT_VAR,  // 默认为对象变量
      value: v.value
    };
  }
};
```

##### 2.2 loadVarDecl 函数 (第1195行)

**修改前：**
```typescript
const loadVarDecl = (list: ImportDecl[], arr: Array<VarDecl>) => {
  // 现有逻辑...
  parsedVarDecl[entry.path] = {
    path: entry.path,
    vars: entry.vars.map((v) => ({ name: v.name, desc: v.desc })),
    depends: entry.depends.slice(),
    modified: entry.modified,
  };
}
```

**修改后：**
```typescript
const loadVarDecl = (list: ImportDecl[], arr: Array<VarDecl>) => {
  // 现有逻辑...
  parsedVarDecl[entry.path] = {
    path: entry.path,
    vars: entry.vars.map((v) => ({ 
      name: v.name, 
      desc: v.desc,
      type: v.type || VarType.OBJECT_VAR,
      value: v.value
    })),
    depends: entry.depends.slice(),
    modified: entry.modified,
  };
}
```

##### 2.3 refreshVarDecl 函数 (第1282行)

**修改前：**
```typescript
export const refreshVarDecl = (root: NodeData, group: string[], declare: FileVarDecl) => {
  // 现有逻辑...
  declare.vars = declare.vars.map((v) => ({ name: v.name, desc: v.desc }));
}
```

**修改后：**
```typescript
export const refreshVarDecl = (root: NodeData, group: string[], declare: FileVarDecl) => {
  // 现有逻辑...
  declare.vars = declare.vars.map((v) => ({ 
    name: v.name, 
    desc: v.desc,
    type: v.type || VarType.OBJECT_VAR,
    value: v.value
  }));
}
```

##### 2.4 createBuildData 函数 (第1076行)

**修改前：**
```typescript
const declare: FileVarDecl = {
  import: tree.import.map((v) => ({ path: v, vars: [], depends: [] })),
  vars: tree.vars.map((v) => ({ name: v.name, desc: v.desc })),
  subtree: [],
};
```

**修改后：**
```typescript
const declare: FileVarDecl = {
  import: tree.import.map((v) => ({ path: v, vars: [], depends: [] })),
  vars: tree.vars.map((v) => ({ 
    name: v.name, 
    desc: v.desc,
    type: v.type || VarType.OBJECT_VAR,
    value: v.value 
  })),
  subtree: [],
};
```

### 3. 文件读写修改

#### 📁 `src/misc/util.ts`

##### 3.1 readTree 函数 (第24行)

**修改前：**
```typescript
export const readTree = (path: string) => {
  const data = readJson(path) as TreeData & { declvar?: VarDecl[] };
  data.version = data.version ?? VERSION;
  data.prefix = data.prefix ?? "";
  data.group = data.group || [];
  data.import = data.import || [];
  data.vars = data.vars || data.declvar || [];
  data.root = data.root || {};
  
  // compatible with old version
  dfs(data.root, (node) => (node.id = node.id.toString()));
  
  return data;
};
```

**修改后：**
```typescript
export const readTree = (path: string) => {
  const data = readJson(path) as TreeData & { declvar?: VarDecl[] };
  data.version = data.version ?? VERSION;
  data.prefix = data.prefix ?? "";
  data.group = data.group || [];
  data.import = data.import || [];
  data.vars = data.vars || data.declvar || [];
  data.root = data.root || {};
  
  // 兼容旧版本：为变量添加默认类型
  data.vars = data.vars.map(v => ({
    name: v.name,
    desc: v.desc,
    type: v.type || VarType.OBJECT_VAR,  // 默认为对象变量
    value: v.value
  }));
  
  // compatible with old version
  dfs(data.root, (node) => (node.id = node.id.toString()));
  
  return data;
};
```

##### 3.2 新增数据迁移函数

```typescript
/**
 * 迁移旧版本变量声明到新格式
 * @param vars 变量声明数组
 * @returns 迁移后的变量声明数组
 */
export const migrateVarDecl = (vars: VarDecl[]): VarDecl[] => {
  return vars.map(v => ({
    name: v.name,
    desc: v.desc,
    type: v.type || VarType.OBJECT_VAR,
    value: v.value
  }));
};
```

### 4. UI 组件修改

#### 📁 `src/components/inspector.tsx`

##### 4.1 VarDeclItem 组件修改

**需要添加的功能：**
- 变量类型选择下拉框
- 根据类型显示不同的值编辑器
- 常量类型：文本输入框
- 对象变量：显示"运行时设置"
- 配置参数：路径输入框（如 ai_cfg.xxx）
- 代码表达式：多行文本框

#### 📁 `src/components/graph.ts`

##### 4.2 变量比较逻辑 (第677行)

**修改前：**
```typescript
const v1: VarDecl | undefined = this.editor.declare.vars[i];
const v2: VarDecl | undefined = editTree.vars[i];
// 只比较 name 和 desc
```

**修改后：**
```typescript
const v1: VarDecl | undefined = this.editor.declare.vars[i];
const v2: VarDecl | undefined = editTree.vars[i];

// 比较所有字段
const isEqual = v1?.name === v2?.name && 
                v1?.desc === v2?.desc &&
                v1?.type === v2?.type &&
                v1?.value === v2?.value;
```

### 5. 运行时处理修改

#### 📁 `src/behavior3/src/behavior3/evaluator.ts`

**新增变量类型处理逻辑：**

```typescript
/**
 * 根据变量类型获取变量值
 * @param varDecl 变量声明
 * @param envars 环境变量
 * @returns 变量值
 */
export const getVariableValue = (varDecl: VarDecl, envars: any): unknown => {
  switch (varDecl.type) {
    case VarType.CONST_VAR:
      // 常量：直接返回预设值
      return varDecl.value;
      
    case VarType.OBJECT_VAR:
      // 对象变量：从环境变量中获取
      return envars[varDecl.name];
      
    case VarType.CFG_VAR:
      // 配置参数：从配置对象中获取
      const configPath = varDecl.value as string;
      return getNestedValue(envars, configPath);
      
    case VarType.CODE_VAR:
      // 代码表达式：执行表达式求值
      const expr = new ExpressionEvaluator(varDecl.value as string);
      return expr.evaluate(envars);
      
    default:
      // 默认：对象变量行为
      return envars[varDecl.name];
  }
};

/**
 * 获取嵌套对象的值（支持 ai_cfg.xxx 格式）
 * @param obj 对象
 * @param path 路径字符串
 * @returns 值
 */
const getNestedValue = (obj: any, path: string): unknown => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};
```

### 6. 类型导出修改

#### 📁 `src/misc/b3type.ts`

**在文件末尾添加导出：**

```typescript
// 导出新增的类型
export { VarType };
```

#### 📁 `src/misc/b3util.ts`

**在导入部分添加：**

```typescript
import {
  // 现有导入...
  VarType,
} from "./b3type";
```

## 兼容性策略

### 1. 向后兼容

- 所有新增字段都是可选的
- 旧版本文件在读取时自动添加默认值
- 现有代码无需修改即可继续工作

### 2. 数据迁移

- 在 `readTree` 函数中自动为旧变量添加默认类型
- 保持文件格式的向前兼容

### 3. 渐进式升级

- 用户可以逐步将变量升级为新格式
- 新旧格式可以在同一个文件中共存
- UI 提供明确的类型选择和值编辑功能

## 总结

本方案通过扩展现有的 `VarDecl` 接口，为行为树变量系统添加了类型化支持，同时保持了完整的向后兼容性。主要修改涉及：

- **1个核心类型定义**：VarDecl 接口扩展 + VarType 枚举
- **4个工具函数**：变量处理逻辑更新 (updateUsingVars, loadVarDecl, refreshVarDecl, createBuildData)
- **2个文件读写函数**：兼容性处理 (readTree, migrateVarDecl)
- **2个UI组件**：编辑界面更新 (inspector.tsx, graph.ts)
- **1个表达式求值器**：运行时支持 (evaluator.ts)
- **类型导出修改**：确保新类型在整个系统中可用

这样的设计既满足了新功能需求，又确保了系统的稳定性和可维护性。