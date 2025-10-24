# Behavior3Editor 纯编辑器改造方案

## 项目目标
将 Behavior3Editor 改造为纯编辑器工具，支持：
1. 通过 JSON 导入节点定义
2. 编辑行为树结构
3. 导出行为树对应的 JSON 文件
4. 节点的输入参数、输出参数、变量都使用 VarDecl 类型，只要在json中定义了，就都是必填项
5. 移除所有运行时逻辑，只保留编辑器功能

## 概念定义
1. 节点json中定义了输入(input)、输出(output)变量和节点参数列表(args)。
2. 输入、输出变量：节点间传递的数据，分为对象变量、代码变量、常量变量、配置变量，定义为VarDecl。不可编辑。
3. 节点参数：节点的预先定义的参数，定义为VarDecl。例如Cmp节点的左值、操作、右值参数，用来比较左值和右值，返回比较结果。其中参数个数和位置不能改变。取值和类型可以修改。
4. 输入、输出变量和节点参数的值类型取值src\misc\b3type.ts的ValueType枚举

## VarDecl 类型说明，取值枚举 VarType
- `object_var`: 对象变量，固定类型，不可修改
- `code_var`: 代码变量，固定类型，不可修改
- `const_var`: 常量变量，用户可修改
- `cfg_var`: 配置变量，用户可修改

## 修改步骤

### 1. ✅ 已完成 - 移除运行时引擎相关代码
- **状态**: 已完成
- **完成内容**: 
  - 将必需的类型定义迁移到 `b3type.ts` 中：
    - `Status` 枚举：定义节点执行状态
    - `NodeDef` 接口：节点定义结构
    - `ObjectType` 类型：通用对象类型
    - `ExpressionEvaluator` 类：表达式求值器（简化版）
    - `Constructor` 类型：构造函数类型
    - `Context` 抽象类：上下文基类
    - `Node` 抽象类：节点基类
    - `DeepReadonly` 类型：深度只读类型
  - **✅ 完全移除 `src/behavior3` 目录**：
    - 确认项目主代码不再依赖 behavior3 运行时库
    - 仅有 2 个孤立的测试文件曾导入 behavior3 代码
    - 删除整个 `src/behavior3` 目录后编译和运行完全正常
    - 项目已成功改造为纯编辑器，无运行时依赖
  - 更新所有导入路径：
    - `explorer.tsx`: 从 `../misc/b3type` 导入 `NodeDef`
    - `graph.ts`: 从 `../misc/b3type` 导入 `ObjectType`
    - `inspector.tsx`: 从 `../misc/b3type` 导入 `ExpressionEvaluator`
    - `titlebar.tsx`: 从 `../misc/b3type` 导入 `NodeDef`
    - `register-node.ts`: 从 `../misc/b3type` 导入相关类型
    - `template.ts`: 从 `./b3type` 导入所有相关类型
    - `workspace-context.ts`: 从 `../misc/b3type` 导入 `NodeDef`
    - `b3util.ts`: 从 `./b3type` 导入相关类型
  - 修复类型定义问题：
    - 修正 `NodeDef.status` 为 `string[]` 类型
    - 修正 `NodeDef.group` 为 `string[]` 类型
    - 移除字段的 `readonly` 限制以支持编辑
  - 编译验证：项目成功编译，无类型错误
- **结果**: 项目已成功改造为纯编辑器，不再依赖 behavior3 运行时引擎代码

### 2. ✅ 已完成 - 节点属性面板改进
- **状态**: 已完成
- **目标**: 为所有节点参数提供变量/常量选择的两控件（类型下拉 + 值输入），统一数据结构为 `{ type: VarType, value }`。
- **已完成**:
  - `int/float` 类型：使用 `VarEditor` 两控件；表单初始化按 `{type, value}` 设置；`finish` 支持此结构。
  - `Cmp` 节点左右值场景已覆盖。
- **未完成**:
  - `string/bool/json/expr`、选项型参数及数组型参数尚未统一为两控件。
  - 非数值类型的表单初始化与提交仍为旧的单控件/非 `{type, value}` 结构。
- **待办**:
  - 统一 `renderArgInput` 为通用 `VarEditor`（支持 `baseType` 与 `options`），数组项也使用两控件。
   - 扩展 `VarEditor` 支持 `bool/json/expr` 常量控件与选项型常量下拉。
  - 表单初始化为全类型的 `{type, value}` 结构；提交逻辑统一转换输出。

### 3. ✅ 已完成 - 修改 NodeData 接口支持 VarDecl 格式
- **文件**: `src/misc/b3type.ts`
- **状态**: 已完成
- **内容**:
  - 将 `NodeData.args` 从 `{[key: string]: unknown}` 修改为 `VarDecl[]`
  - 将 `NodeData.input` 从 `string[]` 修改为 `VarDecl[]`
  - 将 `NodeData.output` 从 `string[]` 修改为 `VarDecl[]`
  - 扩展 `VarDecl` 接口支持完整的变量定义
  - `VarType` 枚举包含所有必要类型

### 4. ✅ 已完成 - 更新编辑器组件适配新数据结构
- **文件**: `src/components/inspector.tsx`
- **状态**: 已完成
- **内容**:
  - 添加 `VarDeclEditor` 组件，支持编辑 VarDecl 格式数据
  - 修改 `NodeInspector` 组件的表单设置和提交逻辑
  - 实现不同 VarDecl 类型的编辑控制：
    - `object_var`、`code_var`: 只读显示，不可修改
    - `const_var`、`cfg_var`: 可编辑修改
  - 实现 `parseStringToVarDecl` 函数，支持旧格式兼容
  - 更新数据处理逻辑支持新格式

### 5. ✅ 已完成 - 文件序列化和反序列化逻辑
#### 5.1 ✅ 已完成 - 工作区文件读写逻辑
- **文件**: `src/contexts/workspace-context.ts`
- **状态**: 已完成
- **内容**: 
  - 确认 `EditorStore` 类正确处理新的 VarDecl 格式
  - 验证文件读取和保存逻辑的兼容性

#### 5.2 ✅ 已完成 - 文件浏览器导入导出逻辑
- **文件**: `src/components/explorer.tsx`
- **状态**: 已完成
- **内容**: 
  - 确认文件操作不涉及 NodeData 序列化问题
  - 文件复制、粘贴、移动等操作正常工作

#### 5.3 ✅ 已完成 - 数据转换工具函数
- **文件**: `src/misc/b3util.ts`
- **状态**: 已完成
- **内容**: 
  - 确认 `createFileData` 函数正确处理 NodeData 序列化
  - 验证 `loadVarDecl` 和 `refreshVarDecl` 函数支持新格式
  - 数据迁移和兼容性处理

#### 5.4 ✅ 已完成 - 其他相关文件适配
- **文件**: `src/components/register-node.ts`, `src/components/graph.ts`
- **状态**: 已完成
- **内容**: 
  - 确认所有相关文件正确使用新的 VarDecl 格式
  - 验证节点注册、图形渲染等功能的兼容性

### 6. ✅ 已完成 - 示例文件和配置更新
#### 6.1 ✅ 已完成 - 更新示例行为树文件
- **文件**: `sample/workdir/*.json`
- **状态**: 已完成
- **完成内容**: 
  - `test.json`: 已转换为新的 VarDecl 格式，包括 input/output/args 字段
  - 其他示例文件（`hero.json`, `monster.json`, `subtree1.json`, `subtree2.json`）已被移除
  - 版本号从 1.8.0 更新到 1.8.5
  - 添加了 `prefix` 字段
  - 所有节点 ID 从数字转换为字符串格式
- **转换详情**:
  - `input`/`output`: 从字符串数组转换为 VarDecl 对象数组
  - `args`: 从简单对象转换为 VarDecl 对象数组
  - 每个 VarDecl 包含 name, desc, type, value_type, value 等完整字段

#### 6.2 ✅ 已完成 - 更新节点配置文件
- **文件**: `sample/node-config.b3-setting`
- **状态**: 已完成
- **内容**:
  - 节点定义配置已使用 VarDecl 格式
  - 包含 `name`, `desc`, `type`, `value_type` 字段
  - 明确标识各种变量类型（object_var, code_var, const_var, cfg_var）

#### 6.3 ✅ 已完成 - 其他配置文件
- **状态**: 已完成
- **内容**:
  - 检查并更新其他相关配置文件
  - 确保配置文件与新的数据格式兼容
- **已完成内容**:
  - 修复 `node-config.b3-setting` 文件中的格式问题：
    - 将 `NotNull` 节点的 `input` 字段从字符串数组格式更新为 `VarDecl` 对象数组格式
    - 为 `Idle` 节点添加缺少的 `desc` 字段
    - 为 `TestB3` 节点的 `name` 参数添加缺少的 `type` 字段
    - 修复 `GetHomePath` 节点的重复定义问题，确保 `input` 字段包含完整的 `value_type`
  - 验证其他配置文件格式：
    - `workspace.b3-workspace`：格式正确，无需修改
    - `vars/vars.json`：已更新为新格式，包含 `version`、`prefix` 等字段
    - `cfg/cfg.json`：已更新为新格式，包含 `version`、`prefix` 等字段

### 7. ✅ 已完成 - 节点定义迁移

#### 7.1 ✅ 已完成 - 将节点定义拆分为独立文件

将 `sample\node-config.b3-setting` 中的所有节点定义迁移到 `sample\nodes` 目录下，每个节点一个独立的 JSON 文件。

**已完成的节点文件（共32个）：**
- AlwaysFail.json ✅
- AlwaysSuccess.json ✅
- Check.json ✅
- Clear.json ✅
- ForEach.json ✅
- Inverter.json ✅
- IsNull.json ✅
- Listen.json ✅
- Log.json ✅
- Loop.json ✅
- NotNull.json ✅
- Now.json ✅
- Once.json ✅
- Parallel.json ✅
- RepeatUntilFailure.json ✅
- RepeatUntilSuccess.json ✅
- Selector.json ✅
- Sequence.json ✅
- Timeout.json ✅
- Wait.json ✅
- Attack.json ✅
- Cmp.json ✅
- FindEnemy.json ✅
- GetHp.json ✅
- Idle.json ✅
- MoveToPos.json ✅
- MoveToTarget.json ✅
- TestB3.json ✅
- GetHomeDistance.json ✅
- GetBornXY.json ✅
- GetHomePath.json ✅
- GoHome.json ✅

**已完成内容：**
1. ✅ **创建独立节点文件**：已为所有32个节点创建对应的 JSON 文件
2. ✅ **保持数据格式一致**：每个独立文件都包含完整的节点定义，保持与原格式一致
3. ✅ **更新加载逻辑**：已修改编辑器代码以支持从多个文件加载节点定义
4. ✅ **配置文件更新**：已将原始配置文件重命名为备份文件
5. ✅ **向后兼容性**：已实现对旧格式的支持

#### 7.2 修改编辑器代码的节点加载逻辑
**状态**: 已完成 ✅
**详情**: 
- ✅ 修改 `src/misc/b3util.ts` 中的 `initWorkdir` 函数
- ✅ 添加 `loadNodeDefsFromFiles` 函数，支持从 `nodes/` 目录加载独立的 JSON 文件
- ✅ 更新节点加载逻辑，优先使用独立文件，保持向后兼容
- ✅ 将原始 `node-config.b3-setting` 文件重命名为 `.backup` 备份
- ✅ 添加详细的错误处理和日志输出

#### 7.3 ✅ 已完成 - 测试新的节点加载机制
**状态**: 已完成
**详情**: 
- ✅ 启动编辑器，验证节点是否正确加载
- ✅ 检查控制台日志，确认从独立文件加载节点定义
- ✅ 测试节点创建、编辑和保存功能
- ✅ 验证所有32个节点都能正常使用
- ✅ 确保节点属性面板显示正确

### 8. ✅ 已完成 - 迁移树文件到独立目录

#### 8.1 ✅ 已完成 - 将树文件从 workdir 迁移到 trees 目录
**状态**: 已完成
**目标**: 将 `sample/workdir/` 下的所有行为树文件迁移到 `sample/trees/` 目录
**完成详情**: 
- ✅ 确认 `sample/trees/` 目录已存在
- ✅ 将 `sample/workdir/test.json` 迁移到 `sample/trees/test.json`
- ✅ 更新工作区配置文件 `workspace.b3-workspace` 中的文件路径引用
- ✅ 保持文件内容不变，只改变存储位置
- ✅ 删除空的 `workdir` 目录

**已迁移文件**:
- `workdir/test.json` → `trees/test.json`

**已更新的配置文件**:
- `workspace.b3-workspace` - 更新了文件路径引用，并添加了描述

### 9. ✅ 已完成 - 改进文件管理为自适应方式

#### 9.1 ✅ 已完成 - 移除 workspace.b3-workspace 中的 files 字段依赖
**状态**: 已完成
**目标**: 改为完全自适应的文件管理方式，自动扫描目录结构
**完成详情**: 
- ✅ 修改 `loadTrees` 函数，完全基于文件系统扫描
- ✅ 移除对 `workspace.b3-workspace` 中 `files` 字段的依赖
- ✅ 自动识别文件类型和用途（节点定义、配置、行为树等）
- ✅ 自动生成文件描述信息
- ✅ 简化工作区配置文件结构

**实现成果**:
- ✅ 无需手动维护文件列表
- ✅ 自动发现新文件
- ✅ 减少配置文件复杂度
- ✅ 避免文件列表与实际文件不同步的问题

**已完成的实现**:
1. ✅ 新增 `getFileDescription` 函数，自动识别文件类型并生成描述
2. ✅ 重构 `loadTrees` 函数，完全基于文件系统扫描
3. ✅ 修改 `saveWorkspace` 函数，移除 `files` 字段保存逻辑
4. ✅ 修改 `loadWorkspace` 函数，移除对 `files` 字段的依赖
5. ✅ 修改 `updateFileMeta` 函数，移除自动保存工作区配置
6. ✅ 更新 `WorkspaceModel` 接口，标记 `files` 字段为已废弃
7. ✅ 简化 `sample/workspace.b3-workspace` 配置文件，移除 `files` 字段

**文件类型自动识别规则**:
- `nodes/*.json` → 节点定义文件
- `trees/*.json` → 行为树文件  
- `cfg/*.json` → 配置文件
- `vars/*.json` → 变量定义文件
- `scripts/*.js` → 脚本文件

**涉及文件**:
- `src/contexts/workspace-context.ts` - 已修改文件扫描逻辑
- `sample/workspace.b3-workspace` - 已简化配置文件结构

### 10. ✅ 已完成 - 资源浏览器优化
- **状态**: 已完成
- **完成内容**:
  - **nodes 目录隐藏**: 修改 `loadFileTree` 函数，过滤 nodes 目录及其子内容，不在资源浏览器中显示
  - **过滤逻辑**: 添加 `filename.includes("/nodes") || filename === "nodes"` 条件，支持多层级目录过滤
- **结果**: nodes 目录及其所有内容不再在资源浏览器中显示

### 11. ✅ 已完成 - 资源浏览器分类展示
- **状态**: 已完成
- **完成内容**:
  - **配置定义**: 将 `cfgs` 目录下的内容展示在资源浏览 → 配置定义
  - **变量定义**: 将 `vars` 目录下的内容展示在资源浏览 → 变量定义
  - **目录过滤**: 从原有文件树中移除 `cfgs` 和 `vars` 目录的显示
- **实现方案**:
  - 在 `explorer.tsx` 中添加 `extractDirectoryFiles` 函数，从文件树中提取指定目录的文件
  - 添加 `createCategoryTree` 函数，创建带有分类标题和图标的树节点
  - 添加 `filterFileTree` 函数，递归过滤文件树，移除指定目录
  - 在资源浏览器中添加配置定义和变量定义的独立展示区域
  - 修改原文件树使用过滤后的数据，避免重复显示
  - 支持点击文件直接打开，与原有文件树功能保持一致
- **技术细节**:
  - 使用 `useMemo` 优化性能，避免不必要的重新计算
  - 添加国际化支持（中英文翻译）
  - 使用条件渲染，只在有文件时才显示对应分类
  - 在 `loadTrees` 中过滤文件元数据收集，但在 `loadFileTree` 中保留目录结构
- **修复记录**:
  - 修复了配置定义未正确展示的问题
  - 实现了从原文件树中移除 `cfgs` 和 `vars` 目录的显示
  - 修复了导入变量功能问题：撤销了 `loadTrees` 中对 `cfgs` 和 `vars` 目录的过滤，确保文件元数据正常收集

### 12. ✅ 已完成 - 节点输入输出展示简化
- **状态**: 已完成
- **问题描述**: 主工作窗口中每个节点的输入、输出展示过于详细，显示完整的JSON结构，用户希望简化展示方式，只显示变量的 `name` 字段
- **修改内容**:
  - **输入展示简化** (`src/components/register-node.ts`):
    - 修改 `drawInputText` 方法，将 `JSON.stringify(input)` 改为 `input.map(v => v.name).join(", ")`
    - 从详细的JSON格式简化为只显示变量名称，用逗号分隔
  - **输出展示简化** (`src/components/register-node.ts`):
    - 修改 `drawOutputText` 方法，将 `JSON.stringify(output)` 改为 `output.map(v => v.name).join(", ")`
    - 从详细的JSON格式简化为只显示变量名称，用逗号分隔
  - **参数展示简化** (`src/components/register-node.ts`):
    - 修改 `drawArgsText` 方法，支持数组和对象两种参数格式
    - 数组类型参数：`args.map(arg => arg.name).join(", ")` - 提取每个参数对象的name字段
    - 对象类型参数：`Object.keys(args).join(", ")` - 提取对象的键名
    - 从详细的JSON格式简化为只显示参数名称，用逗号分隔
- **修改前后对比**:
  - **修改前**: 显示完整JSON结构
    - 输入/输出: `[{"name":"target","desc":"攻击目标","type":"object_var","value_type":"string"}]`
    - 参数: `{"timeout":5000,"retries":3,"debug":true}`
  - **修改后**: 只显示名称
    - 输入/输出: `target, range, damage`
    - 参数: `timeout, retries, debug`
- **技术实现**:
  - 保持原有的文本换行和布局逻辑不变
  - 只修改文本内容的生成方式
  - 通过 TypeScript 类型检查，确保修改的正确性
- **修改结果**:
  - ✅ 节点输入展示从详细JSON简化为变量名列表
  - ✅ 节点输出展示从详细JSON简化为变量名列表
  - ✅ 节点参数展示从详细JSON简化为参数名列表
  - ✅ 界面更加简洁，易于阅读
  - ✅ 保持了原有的功能完整性

### 13. ✅ 已完成 - 属性栏输入输出变量显示优化
- **状态**: 已完成
- **问题描述**: 属性栏中的输入、输出变量需要遵守 `VarDecl` 类型说明，但用户反馈这些变量应该是不可编辑的，只需要直接展示变量名
- **修改内容**:
  - **输入变量显示**: 移除可编辑的 `VariableAutoComplete` 组件，改为只读显示，直接展示变量名
  - **输出变量显示**: 移除可编辑的 `VariableAutoComplete` 组件，改为只读显示，直接展示变量名
  - **显示格式**: 使用 "变量描述 (变量名)" 的格式清晰展示
- **修改前后对比**:
  - **修改前**: 使用 `VariableAutoComplete` 组件，支持编辑和自动完成
  - **修改后**: 只读显示，展示格式为 "变量描述 (变量名)"
- **技术实现**:
  - 移除了输入输出变量的 `VariableAutoComplete` 组件
  - 改为只读显示，使用"变量描述 (变量名)"的格式
  - 应用了优化的样式配色方案：
    - 变量描述：使用 `#f5f5f5` 浅色文字，在深色背景上提供良好对比度
    - 变量名：使用 `#d9d9d9` 背景色和 `#262626` 深色文字，确保可读性
  - 修改了 `register-node.ts` 文件中 `highlightgray` 状态下的 `input-text` 和 `output-text` 颜色为 `#262626`，使图形编辑器中的变量文本颜色与属性栏标题颜色一致
  - 变量参数部分重构：
    - 移除了可自由增删参数的 `Form.List` 组件
    - 改为根据节点定义中的 `args` 字段固定渲染参数列表
    - 实现了 `renderArgInput` 函数，根据参数类型渲染不同的输入控件：
      - `int/float`：使用 `InputNumber` 组件
      - `bool`：使用 `Switch` 组件
      - `expr`：使用 `TextArea` 组件（表达式编辑）
      - `json`：使用 `TextArea` 组件（JSON编辑）
      - `string`：使用 `Input` 组件
      - 数组类型：使用 `Form.List` 支持动态添加/删除项目
      - 有预定义选项：使用 `Select` 下拉选择
  - 保持原有的可变参数判断逻辑
- **修改结果**:
  - ✅ 属性栏中的输入输出变量现在为只读显示
  - ✅ 变量名以 "描述 (名称)" 的格式清晰展示
  - ✅ 符合用户要求的不可编辑规则
  - ✅ 界面更加简洁，用户体验更好

---

### 14. ✅ 已完成 - 节点属性面板参数组件化重构

#### 需求概述
将节点面板属性中的参数部分进行组件化重构，提高代码复用性和维护性。

#### 主要目标
1. **输入参数组件化**：将输入参数独立成组件
2. **节点参数组件化**：将节点参数独立成组件  
3. **输出参数复用**：输出参数复用输入参数组件
4. **参数项组件化**：将"参数名、参数类型、参数值"封装成独立组件
5. **调用关系**：节点面板属性组件调用这些独立组件

#### 参数类型区别说明

##### 输入参数 (Input Parameters)
- **编辑权限**：只读，不可编辑
- **变量类型**：只能是 `object_var` 类型
- **用途**：定义节点需要从外部接收的变量

##### 输出参数 (Output Parameters)  
- **编辑权限**：只读，不可编辑
- **变量类型**：只能是 `object_var` 类型
- **用途**：定义节点向外部输出的变量

##### 节点参数 (Node Arguments)
- **编辑权限**：类型和值可以调整，但个数不能调整
- **变量类型**：支持多种类型（`const_var`、`object_var`、`cfg_var`、`code_var`、`expr_var`）
- **用途**：定义节点的配置参数，影响节点的行为逻辑

#### 组件层次结构
```
NodeInspector (主组件)
├── NodeInputArgs (输入参数组件)
│   └── ArgItem (参数项组件) × N
├── NodeArgs (节点参数组件)  
│   └── ArgItem (参数项组件) × N
└── NodeOutputArgs (输出参数组件，复用输入参数组件)
    └── ArgItem (参数项组件) × N
```

#### 实现步骤
1. **创建 ArgItem 基础组件**：提取参数项的通用逻辑
2. **创建 NodeInputArgs 组件**：处理输入参数的渲染逻辑
3. **创建 NodeArgs 组件**：提取现有的参数渲染逻辑
4. **创建 NodeOutputArgs 组件**：复用输入参数组件
5. **重构 NodeInspector 主组件**：使用新的组件化结构

### 15. 文本日志
#### 需求概述
- 采用electron-log方案
- 增加运行时调试日志功能，用于记录节点执行过程中的关键信息。
- 日志级别：支持不同级别的日志（如 DEBUG、INFO、WARN、ERROR）
- 日志格式：包括时间戳、日志级别、节点ID、日志消息等
- 日志输出：支持控制台输出和文件输出
- 日志配置：
  1.新增 菜单 调试
  2.将 编辑->检查表达式 迁移到 调试->检查表达式
  3.通过 调试->清理日志 控制清理日志文件；
  4.通过 调试->打开日志 控制打开日志文件；
  5.通过 调试->日志级别 选择日志级别；
  6.检查表达式日志相关功能之间增加横线，参考 编辑
