/**
 * 行为树编辑器核心类型定义文件
 * 
 * 本文件定义了整个编辑器使用的核心数据结构：
 * - 节点数据结构（NodeData）
 * - 行为树数据结构（TreeData）
 * - 变量和导入声明
 * - 类型检查工具函数
 * - 从运行时引擎提取的必要类型定义
 * 
 * 这些类型定义了行为树的存储格式（JSON），也是编辑器和运行时之间的数据契约。
 */

// ============================================
// 从运行时引擎提取的类型定义
// ============================================

/**
 * 节点执行状态枚举
 */
export const enum Status {
  SUCCESS = "success",
  FAILURE = "failure", 
  RUNNING = "running"
}

/**
 * 对象类型定义
 */
export type ObjectType = { [k: string]: unknown };

/**
 * 构造函数类型
 */
export type Constructor<T, A extends any[] = any[]> = new (...args: A) => T;

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T;

/**
 * 表达式求值器类
 */
export class ExpressionEvaluator {
    private _postfix: any[];
    private _args: ObjectType | null = null;
    private _expr: string;

    constructor(expression: string) {
        this._expr = expression;
        this._postfix = [];
    }

    evaluate(args: ObjectType): unknown {
        // 简化的求值实现，仅用于编辑器类型检查
        return undefined;
    }

    dryRun(): boolean {
        // 简化的干运行实现
        return true;
    }
}

/**
 * 节点定义接口
 */
export interface NodeDef {
    /** 节点名称 */
    readonly name: string;
    /** 节点类型 */
    readonly type: "Action" | "Composite" | "Condition" | "Decorator";
    /** 节点描述 */
    readonly desc?: string;
    /** 输入变量定义 */
    readonly input?: VarDecl[];
    /** 输出变量定义 */
    readonly output?: VarDecl[];
    /** 参数定义 */
    readonly args?: VarDecl[];
    /** 文档链接 */
    readonly doc?: string;
    /** 图标 */
    readonly icon?: string;
    /** 颜色 */
    readonly color?: string;
    /** 分组 */
    readonly group?: string[];
    /** 状态 */
    readonly status?: string[];
    /** 子节点数量限制 */
    readonly children?: number;
}

/**
 * 节点基类（简化版，仅用于编辑器）
 */
export abstract class Node {
    constructor(public readonly def: NodeDef) {}
}

/**
 * 上下文基类（简化版，仅用于编辑器）
 */
export abstract class Context {
    readonly nodeDefs: Record<string, DeepReadonly<NodeDef>> = {};
    
    constructor() {}
    
    abstract loadTree(path: string): Promise<Node>;
}

// ============================================
// 第一部分：全局常量
// ============================================

/**
 * 编辑器版本号
 * 
 * 用途：
 * - 显示在标题栏和关于界面
 * - 检测行为树文件的兼容性
 * - 自动更新版本比对
 */
export const VERSION = "1.8.5";

/**
 * JavaScript 保留关键字列表
 * 
 * 这些关键字不能用作变量名，编辑器会在输入时进行验证
 * 
 * 使用场景：
 * - 验证用户输入的变量名
 * - 验证节点参数名
 * - 表达式编辑器的语法高亮
 */
export const keyWords = ["true", "false", "null", "undefined", "NaN", "Infinity"];

// ============================================
// 第二部分：枚举定义
// ============================================

/**
 * 行为树变量类型枚举
 * 
 * 定义了行为树中变量的四种类型：
 * - 常量：编译时确定的固定值
 * - 对象变量：运行时从环境变量中获取
 * - 配置参数：从配置对象中读取的值
 * - 代码表达式：需要动态执行的表达式
 */
export const enum ArgType {
  /** 常量 - 编译时确定的固定值 */
  CONST_VAR = "const_var",
  /** 对象变量 - 运行时从环境变量中获取 */
  OBJECT_VAR = "object_var", 
  /** 配置参数 - 从配置对象中读取（cfg.json） */
  CFG_VAR = "cfg_var",
  /** 代码表达式 - 需要动态执行的表达式 */
  CODE_VAR = "code_var",
  /** JSON 变量 - 存储和传递 JSON 格式数据 */
  JSON_VAR = "json_var",
}

/**
 * 节点参数值类型枚举
 * 
 * 定义了节点参数支持的所有数据类型：
 * - 基础类型：bool, int, float, string, json, expr
 * - 可选类型：在基础类型后加 ?
 * - 数组类型：在基础类型后加 []
 * - 可选数组：在数组类型后加 ?
 */
export const enum ValueType {
  // 基础类型
  /** 布尔值 */
  BOOL = "bool",
  /** 整数 */
  INT = "int", 
  /** 浮点数 */
  FLOAT = "float",
  /** 字符串 */
  STRING = "string",
  /** JSON 对象 */
  JSON = "json",
  /** 表达式 */
  EXPR = "expr",
  
  // 可选类型
  /** 可选布尔值 */
  BOOL_OPTIONAL = "bool?",
  /** 可选整数 */
  INT_OPTIONAL = "int?",
  /** 可选浮点数 */
  FLOAT_OPTIONAL = "float?",
  /** 可选字符串 */
  STRING_OPTIONAL = "string?",
  /** 可选 JSON 对象 */
  JSON_OPTIONAL = "json?",
  /** 可选表达式 */
  EXPR_OPTIONAL = "expr?",
  
  // 数组类型
  /** 布尔值数组 */
  BOOL_ARRAY = "bool[]",
  /** 整数数组 */
  INT_ARRAY = "int[]",
  /** 浮点数数组 */
  FLOAT_ARRAY = "float[]",
  /** 字符串数组 */
  STRING_ARRAY = "string[]",
  /** JSON 对象数组 */
  JSON_ARRAY = "json[]",
  /** 表达式数组 */
  EXPR_ARRAY = "expr[]",
  
  // 可选数组类型
  /** 可选布尔值数组 */
  BOOL_ARRAY_OPTIONAL = "bool[]?",
  /** 可选整数数组 */
  INT_ARRAY_OPTIONAL = "int[]?",
  /** 可选浮点数数组 */
  FLOAT_ARRAY_OPTIONAL = "float[]?",
  /** 可选字符串数组 */
  STRING_ARRAY_OPTIONAL = "string[]?",
  /** 可选 JSON 对象数组 */
  JSON_ARRAY_OPTIONAL = "json[]?",
  /** 可选表达式数组 */
  EXPR_ARRAY_OPTIONAL = "expr[]?",
}

// ============================================
// 第三部分：类型别名
// ============================================

/**
 * 节点类型枚举
 * 
 * 扩展自 NodeDef 的 type 属性，增加了 "Other" 和 "Error" 类型
 * 
 * 类型说明：
 * - "Action":    行为节点（叶子节点，执行具体操作）
 * - "Decorator": 装饰节点（单个子节点，修饰行为）
 * - "Condition": 条件节点（叶子节点，判断条件）
 * - "Composite": 复合节点（多个子节点，控制流程）
 * - "Other":     自定义类型
 * - "Error":     错误节点（节点定义未找到）
 */
export type NodeType = NodeDef["type"] | "Other" | "Error";

/**
 * 选项声明接口
 * 
 * 用于定义节点参数的可选值列表，支持下拉选择框等 UI 组件
 * 
 * 示例：
 * ```typescript
 * const logLevelOptions: OptionDecl[] = [
 *   { name: "INFO", value: "info", desc: "信息级别日志" },
 *   { name: "DEBUG", value: "debug", desc: "调试级别日志" },
 *   { name: "ERROR", value: "error", desc: "错误级别日志" }
 * ];
 * ```
 */
export interface OptionDecl {
  /** 选项显示名称 */
  name: string;
  /** 选项实际值 */
  value: unknown;
  /** 选项描述（可选） */
  desc?: string;
}

/**
 * NodeArg - 节点参数类型
 * 
 * 统一使用 VarDecl 作为节点参数类型，确保类型一致性
 * 
 * 这样做的好处：
 * - 统一变量声明和节点参数的数据结构
 * - 便于代码复用和维护
 * - 类型检查更加严格
 * 
 * 示例：
 * NodeArg = { name: string, desc: string, type: VarType, value_type: ValueType, ... }
 */
export type NodeArg = VarDecl;

// ============================================
// 第三部分：类型检查工具函数
// ============================================

/**
 * 检查参数类型是否为整数类型
 * 
 * 匹配的类型：
 * - "int"      单个整数
 * - "int?"     可选整数
 * - "int[]"    整数数组
 * - "int[]?"   可选整数数组
 * 
 * 用途：在属性检查器中决定显示什么类型的输入控件
 */
export const isIntType = (type: string) => type.startsWith("int");

/**
 * 检查参数类型是否为浮点数类型
 * 
 * 匹配的类型：
 * - "float"    单个浮点数
 * - "float?"   可选浮点数
 * - "float[]"  浮点数数组
 * - "float[]?" 可选浮点数数组
 */
export const isFloatType = (type: string) => type.startsWith("float");

/**
 * 检查参数类型是否为字符串类型
 * 
 * 匹配的类型：
 * - "string"    单个字符串
 * - "string?"   可选字符串
 * - "string[]"  字符串数组
 * - "string[]?" 可选字符串数组
 */
export const isStringType = (type: string) => type.startsWith("string");

/**
 * 检查参数类型是否为布尔类型
 * 
 * 匹配的类型：
 * - "bool"    单个布尔值
 * - "bool?"   可选布尔值
 * - "bool[]"  布尔值数组
 * - "bool[]?" 可选布尔值数组
 */
export const isBoolType = (type: string) => type.startsWith("bool");

/**
 * 检查参数类型是否为表达式类型
 * 
 * 表达式类型允许用户输入 JavaScript 表达式，在运行时求值
 * 
 * 匹配的类型：
 * - "expr"    表达式
 * - "expr?"   可选表达式
 * - "code"    代码（别名）
 * 
 * 示例表达式：
 * - "a + b"
 * - "Math.random() > 0.5"
 * - "user.level >= 10"
 */
export const isExprType = (type: string) => type.startsWith("expr") || type.startsWith("code");

/**
 * 检查参数类型是否为 JSON 类型
 * 
 * JSON 类型用于复杂的数据结构
 * 
 * 匹配的类型：
 * - "json"    JSON 对象
 * - "json?"   可选 JSON 对象
 * - "json[]"  JSON 对象数组
 * - "json[]?" 可选 JSON 对象数组
 */
export const isJsonType = (type: string) => type.startsWith("json");

/**
 * 检查节点参数是否有预定义选项
 * 
 * 如果参数有 options 属性，则在 UI 中显示为下拉选择框
 * 
 * 示例：
 * {
 *   name: "operator",
 *   type: "string",
 *   desc: "运算符",
 *   options: [
 *     { name: "加法", value: "+" },
 *     { name: "减法", value: "-" }
 *   ]
 * }
 * 
 * @param arg 节点参数定义
 * @returns 是否有预定义选项
 */
export const hasArgOptions = (arg: NodeArg) => arg.options !== undefined;

// ============================================
// 第四部分：核心数据结构
// ============================================

/**
 * 节点数据接口（核心）
 * 
 * 这是行为树中单个节点的完整数据结构，包含编辑器和运行时所需的所有信息。
 * 
 * 数据流：
 * 1. 编辑器创建/编辑节点 → NodeData
 * 2. 保存到 JSON 文件
 * 3. 运行时加载 JSON → 执行行为树
 * 
 * 示例 JSON：
 * {
 *   "id": "node_1",
 *   "name": "Wait",
 *   "desc": "等待 1 秒",
 *   "args": { "time": 1.0 },
 *   "debug": false
 * }
 */
export interface NodeData {
    /**
     * 节点唯一标识符
     * 
     * 格式：通常是 "node_" + 递增数字（如 "node_1", "node_2"）
     * 用途：
     * - 在树结构中引用节点
     * - 建立父子关系
     * - G6 图形库的节点 ID
     */
    id: string;

    /**
     * 节点类型名称
     * 
     * 对应节点定义（NodeDef）中的 name 字段
     * 
     * 示例：
     * - "Wait"        等待节点
     * - "Sequence"    顺序执行节点
     * - "Selector"    选择执行节点
     * - "FindEnemy"   自定义节点
     * 
     * 用途：
     * - 查找节点定义（从 node-config.b3-setting）
     * - 决定节点的图标、颜色
     * - 运行时创建对应的节点实例
     */
    name: string;

    /**
     * 节点描述（可选）
     * 
     * 用户自定义的节点说明，帮助理解这个节点的具体用途
     * 
     * 示例：
     * - "检查玩家是否在攻击范围内"
     * - "等待 2 秒后继续"
     * 
     * 显示位置：
     * - 节点悬停提示
     * - 属性检查器
     */
    desc?: string;

    /**
     * 节点参数（可选）
     * 
     * 使用 VarDecl 格式存储节点的配置参数，支持多种变量类型
     * 
     * 示例：
     * [
     *   { name: "time", desc: "等待时间", type: "const_var", value_type: "float", value: 1.5 },
     *   { name: "count", desc: "重试次数", type: "object_var", value_type: "int" },
     *   { name: "message", desc: "日志消息", type: "const_var", value_type: "string", value: "Hello" }
     * ]
     * 
     * 用途：
     * - 配置节点行为
     * - 在属性检查器中编辑
     * - 支持常量、变量、表达式等多种类型
     */
    args?: VarDecl[];

    /**
     * 输入变量列表（可选）
     * 
     * 使用 VarDecl 格式定义节点的输入变量，支持类型检查和默认值
     * 
     * 示例：
     * [
     *   { name: "target", desc: "攻击目标", type: "object_var", value_type: "string" },
     *   { name: "range", desc: "攻击范围", type: "const_var", value_type: "float", value: 10.0, optional: true }
     * ]
     * 
     * 用途：
     * - 定义节点需要的输入数据
     * - 支持类型验证和默认值
     * - 提供更丰富的编辑体验
     */
    input?: VarDecl[];

    /**
     * 输出变量列表（可选）
     * 
     * 使用 VarDecl 格式定义节点的输出变量，支持类型声明
     * 
     * 示例：
     * [
     *   { name: "result", desc: "执行结果", type: "object_var", value_type: "bool" },
     *   { name: "damage", desc: "造成伤害", type: "object_var", value_type: "int" }
     * ]
     * 
     * 用途：
     * - 定义节点产生的输出数据
     * - 支持类型声明和验证
     * - 便于下游节点使用
     */
    output?: VarDecl[];

    /**
     * 子节点列表（可选）
     * 
     * 只有 Composite 和 Decorator 节点才有子节点
     * 
     * 节点类型限制：
     * - Action/Condition:  children 必须为空或 undefined
     * - Decorator:         children 长度必须为 1
     * - Composite:         children 可以有多个
     * 
     * 递归结构：
     * NodeData 可以包含 NodeData[]，形成树形结构
     * 
     * 示例：
     * {
     *   "id": "1",
     *   "name": "Sequence",
     *   "children": [
     *     { "id": "2", "name": "Wait", "args": { "time": 1 } },
     *     { "id": "3", "name": "Log", "args": { "message": "Done" } }
     *   ]
     * }
     */
    children?: NodeData[];

    /**
     * 调试模式（可选）
     * 
     * 启用后，运行时会输出这个节点的详细执行信息
     * 
     * 用途：
     * - 调试行为树逻辑
     * - 查看节点的输入输出
     * - 追踪执行流程
     * 
     * 显示：
     * - 编辑器中以特殊样式标记
     * - 运行时输出日志
     */
    debug?: boolean;

    /**
     * 禁用状态（可选）
     * 
     * 禁用的节点在运行时会被跳过（直接返回 success）
     * 
     * 用途：
     * - 临时禁用某个节点进行测试
     * - 不删除节点但暂时不执行
     * 
     * 显示：
     * - 编辑器中以灰色显示
     * - 节点上有禁用图标
     */
    disabled?: boolean;

    /**
     * 子树路径（可选）
     * 
     * 如果这个节点引用了外部子树，path 指向子树文件的相对路径
     * 
     * 示例：
     * - "sub/attack.json"
     * - "./subtree1.json"
     * 
     * 工作流程：
     * 1. 编辑器检测到 path 属性
     * 2. 加载对应的子树文件
     * 3. 显示为特殊的子树节点
     * 4. 运行时动态加载子树
     */
    path?: string;

    // ============================================
    // 运行时属性（不保存到文件）
    // ============================================

    /**
     * 文件修改时间（运行时）
     * 
     * 子树文件的最后修改时间戳（毫秒）
     * 用于检测文件变化，决定是否重新加载
     * 
     * 仅在内存中，不保存到 JSON
     */
    mtime?: number;

    /**
     * 节点尺寸（运行时）
     * 
     * G6 图形库中节点的宽高：[width, height]
     * 
     * 示例：[120, 60]
     * 
     * 用途：
     * - 布局计算
     * - 碰撞检测
     * - 渲染节点
     * 
     * 仅在内存中，不保存到 JSON
     */
    size?: number[];

    /**
     * 节点执行状态（运行时）
     * 
     * 行为树运行时的节点状态，用于可视化调试
     * 
     * 状态值：
     * - 0: 未执行
     * - 1: 成功 (success)
     * - 2: 失败 (failure)
     * - 3: 运行中 (running)
     * 
     * 用途：
     * - 实时调试界面
     * - 显示节点的执行状态
     * - 高亮当前执行的节点
     * 
     * 仅在内存中，不保存到 JSON
     */
    status?: number;
}

/**
 * 节点布局模式
 * 
 * 控制节点在编辑器中的显示方式
 * 
 * - "compact": 紧凑模式（只显示图标和名称）
 * - "normal":  正常模式（显示完整信息）
 * 
 * 用途：
 * - 大型行为树时使用紧凑模式节省空间
 * - 编辑时使用正常模式查看详细信息
 */
export type NodeLayout = "compact" | "normal";

/**
 * 变量声明接口
 * 
 * 用于声明行为树中使用的变量，帮助策划理解和使用变量
 * 
 * 变量声明不影响运行时逻辑，只是文档说明
 * 
 * 示例：
 * {
 *   "name": "enemyCount",
 *   "type": "object_var",
 *   "value_type": "int",
 *   "desc": "当前敌人数量"
 * }
 */
export interface VarDecl {
  /**
   * 变量名
   * 
   * 命名规则：
   * - 推荐使用下划线命名法（snake_case）
   * - 不能使用保留关键字
   * 
   * 示例：
   * - "target"
   * - "player_level"
   * - "is_alive"
   */
  name: string;

  /**
   * 变量描述
   * 
   * 说明这个变量的用途、类型、取值范围等
   * 
   * 示例：
   * - "攻击目标，类型：敌人对象"
   * - "玩家等级，范围：1-100"
   */
  desc?: string;

  /**
   * 变量类型
   * 
   * 定义变量的具体类型和行为
   */
  type: ArgType;

  /**
   * 值类型
   * 
   * 定义变量值的具体类型，用于类型检查和验证
   */
  value_type: ValueType;

  /**
   * 变量值
   * 
   * 根据变量类型存储不同的值：
   * - 常量：具体的值
   * - 对象变量：undefined（运行时设置）
   * - 配置参数：配置路径字符串
   * - 代码表达式：表达式字符串
   */
  value?: unknown;

  /**
   * 默认值（可选）
   * 
   * 当变量未被赋值时使用的默认值
   * 
   * 示例：
   * - 0
   * - false
   * - "default"
   */
  default?: unknown;
  
  /**
   * 是否为可选参数
   * 
   * 当为 true 时，该变量可以不提供值
   */
  optional?: boolean;
  
  /** 枚举选项（可选） */
  options?: OptionDecl[];
}

/**
 * 分组声明接口
 * 
 * 用于控制行为树的分组显示和过滤
 * 
 * 在文件浏览器中，可以按分组筛选行为树
 */
export interface GroupDecl {
  /**
   * 分组名称
   * 
   * 示例：
   * - "Hero"     英雄 AI
   * - "Monster"  怪物 AI
   * - "NPC"      NPC 行为
   */
  name: string;

  /**
   * 是否启用
   * 
   * 控制这个分组的行为树是否在文件浏览器中显示
   */
  value: boolean;
}

/**
 * 导入声明接口
 * 
 * 记录行为树导入的子树或变量文件信息
 * 
 * 用途：
 * - 依赖管理
 * - 变量提示
 * - 修改检测
 * 
 * 工作流程：
 * 1. 行为树导入子树：import: ["sub/attack.json"]
 * 2. 编辑器解析子树文件
 * 3. 提取变量声明和依赖关系
 * 4. 存储在 ImportDecl 中
 * 5. 用于代码补全和验证
 */
export interface ImportDecl {
  /**
   * 导入文件的相对路径
   * 
   * 示例：
   * - "sub/attack.json"
   * - "./vars/common.json"
   * - "../shared/utils.json"
   */
  path: string;

  /**
   * 文件最后修改时间（可选）
   * 
   * 时间戳（毫秒）
   * 
   * 用途：
   * - 检测文件是否被修改
   * - 决定是否需要重新加载
   * - 显示更新提示
   */
  modified?: number;

  /**
   * 文件中声明的变量列表
   * 
   * 从导入的文件中提取的变量声明
   * 
   * 用途：
   * - 变量名自动补全
   * - 变量悬停提示
   * - 变量使用检查
   */
  vars: VarDecl[];

  /**
   * 文件的依赖关系
   * 
   * 导入的文件可能又导入了其他文件，形成依赖链
   * 
   * 示例：
   * A.json imports B.json
   * B.json imports C.json
   * 
   * A.json 的 depends:
   * [
   *   { path: "B.json", modified: 1234567890 },
   *   { path: "C.json", modified: 1234567891 }
   * ]
   * 
   * 用途：
   * - 检测循环依赖
   * - 批量重新加载
   * - 依赖图可视化
   */
  depends: {
    /** 依赖文件路径 */
    path: string;
    /** 依赖文件修改时间 */
    modified: number;
  }[];
}

/**
 * 文件变量声明接口
 * 
 * 汇总一个行为树文件中所有的变量声明，包括：
 * - 导入的变量文件
 * - 导入的子树
 * - 本文件声明的变量
 * 
 * 用途：
 * - 统一的变量管理
 * - 变量命名检查
 * - 代码补全数据源
 * 
 * 示例场景：
 * hero.json:
 * - import: ["vars/common.json"]      → 导入通用变量
 * - import: ["sub/attack.json"]       → 导入攻击子树
 * - vars: [{ name: "hp", desc: "血量" }]  → 本地变量
 */
export interface FileVarDecl {
  /**
   * 导入的变量文件列表
   * 
   * 用于存储公共变量声明，多个行为树可以共享
   * 
   * 示例：
   * - "vars/common.json"  通用变量
   * - "vars/hero.json"    英雄专用变量
   */
  import: ImportDecl[];

  /**
   * 导入的子树列表
   * 
   * 子树文件本身也可能声明变量（作为输出）
   * 这些变量需要被父树知道
   * 
   * 示例：
   * 攻击子树输出 "damage"
   * 父树可以使用这个变量
   */
  subtree: ImportDecl[];

  /**
   * 本文件声明的变量
   * 
   * 这个行为树文件内部使用的变量
   * 
   * 作用域：
   * - 本文件可见
   * - 导入这个文件的父文件也可见（作为子树输出）
   */
  vars: VarDecl[];
}

/**
 * 行为树数据接口（核心）
 * 
 * 这是保存到 .json 文件的完整行为树数据结构
 * 
 * 文件示例：hero.json
 * {
 *   "version": "1.8.5",
 *   "name": "Hero",
 *   "prefix": "hero",
 *   "desc": "英雄 AI 行为树",
 *   "export": true,
 *   "group": ["Hero", "Combat"],
 *   "import": ["sub/attack.json"],
 *   "vars": [
 *     { "name": "hp", "desc": "生命值" },
 *     { "name": "mp", "desc": "魔法值" }
 *   ],
 *   "root": {
 *     "id": "1",
 *     "name": "Sequence",
 *     "children": [...]
 *   }
 * }
 * 
 * 数据流：
 * 1. 编辑器 → TreeData → JSON 文件
 * 2. JSON 文件 → TreeData → 运行时加载
 */
export interface TreeData {
  /**
   * 行为树格式版本号
   * 
   * 用途：
   * - 兼容性检查
   * - 格式升级迁移
   * - 编辑器版本验证
   * 
   * 通常与编辑器版本一致：VERSION 常量
   */
  version: string;

  /**
   * 行为树名称
   * 
   * 通常与文件名一致（不含扩展名）
   * 
   * 示例：
   * - "Hero"     英雄 AI
   * - "Monster"  怪物 AI
   * - "Attack"   攻击子树
   * 
   * 用途：
   * - 显示在编辑器标题
   * - 文件浏览器中显示
   * - 日志输出
   */
  name: string;

  /**
   * 变量名前缀
   * 
   * 用于生成局部变量的命名空间，避免变量名冲突
   * 
   * 示例：
   * prefix: "hero"
   * 变量 "hp" 实际在黑板上的完整名称："{hero}hp"
   * 
   * 作用：
   * - 多个行为树同时运行时隔离变量
   * - 子树变量与父树变量隔离
   * 
   * 使用场景：
   * Hero.json (prefix: "hero")
   *   uses: {hero}hp, {hero}mp
   * Monster.json (prefix: "monster")
   *   uses: {monster}hp, {monster}mp
   * 
   * 两棵树可以同时运行而不会变量冲突
   */
  prefix: string;

  /**
   * 行为树描述（可选）
   * 
   * 详细说明这棵树的用途、逻辑、注意事项等
   * 
   * 示例：
   * "英雄的战斗 AI，包括寻敌、移动、攻击、技能释放等逻辑"
   * 
   * 显示位置：
   * - 属性检查器
   * - 树列表的悬停提示
   */
  desc?: string;

  /**
   * 是否导出（可选）
   * 
   * 标记这棵树是否可以被其他树导入为子树
   * 
   * 用途：
   * - export: true  → 可以被导入（公共子树）
   * - export: false → 仅供独立使用（主树）
   * 
   * 示例：
   * Attack.json:  export: true  → 攻击子树，供其他树导入
   * Hero.json:    export: false → 英雄主 AI，不导出
   * 
   * 影响：
   * - 文件浏览器中的图标
   * - 导入时的筛选列表
   */
  export?: boolean;

  /**
   * 分组标签
   * 
   * 行为树可以属于多个分组，用于组织和筛选
   * 
   * 示例：
   * - ["Hero", "Combat"]     英雄战斗树
   * - ["Monster", "Boss"]    Boss 怪物树
   * - ["NPC", "Quest"]       任务 NPC 树
   * 
   * 用途：
   * - 文件浏览器按分组筛选
   * - 批量操作同一分组的树
   * - 构建打包时分组打包
   */
  group: string[];

  /**
   * 导入的子树列表
   * 
   * 引用的外部行为树文件路径（相对路径）
   * 
   * 示例：
   * [
   *   "sub/attack.json",
   *   "sub/defense.json",
   *   "./common/idle.json"
   * ]
   * 
   * 用途：
   * - 复用公共逻辑
   * - 模块化设计
   * - 依赖管理
   * 
   * 工作流程：
   * 1. 编辑器加载树时读取 import 列表
   * 2. 递归加载所有子树文件
   * 3. 构建完整的依赖图
   * 4. 提供子树节点供插入
   * 
   * 运行时：
   * - 动态加载子树
   * - 或预先打包所有子树
   */
  import: string[];

  /**
   * 变量声明列表
   * 
   * 这棵树使用的所有变量的声明（文档）
   * 
   * 示例：
   * [
   *   { "name": "hp", "desc": "当前生命值" },
   *   { "name": "target", "desc": "攻击目标" }
   * ]
   * 
   * 用途：
   * - 变量自动补全
   * - 悬停提示
   * - 文档生成
   * 
   * 注意：
   * - 不影响运行时
   * - 只是帮助策划理解和使用
   */
  vars: VarDecl[];

  /**
   * 根节点数据
   * 
   * 整棵行为树的入口节点，通常是一个 Composite 节点
   * 
   * 递归结构：
   * root 包含 children
   * children 又包含 children
   * ...
   * 形成完整的树形结构
   * 
   * 示例：
   * {
   *   "id": "1",
   *   "name": "Sequence",
   *   "children": [
   *     {
   *       "id": "2",
   *       "name": "FindEnemy",
   *       "input": ["range"],
   *       "output": ["target"]
   *     },
   *     {
   *       "id": "3",
   *       "name": "MoveTo",
   *       "input": ["target"]
   *     },
   *     {
   *       "id": "4",
   *       "name": "Attack",
   *       "input": ["target"]
   *     }
   *   ]
   * }
   * 
   * 执行流程：
   * 1. 从 root 开始执行
   * 2. 根据节点类型调度子节点
   * 3. 递归执行整棵树
   * 4. 返回最终状态
   */
  root: NodeData;
}

// ============================================
// 第五部分：工具函数
// ============================================

/**
 * 从节点定义获取规范化的节点类型
 * 
 * 将 NodeDef 中可能不规范的类型字符串转换为标准的 NodeType
 * 
 * 处理逻辑：
 * - 不区分大小写
 * - 支持部分匹配（前缀匹配）
 * - 容错处理
 * 
 * 示例：
 * "action" → "Action"
 * "Action" → "Action"
 * "ACTION" → "Action"
 * "ActionXXX" → "Action"  (前缀匹配)
 * "unknown" → "Other"
 * 
 * @param def 节点定义
 * @returns 标准化的节点类型
 * 
 * 用途：
 * - 节点分类显示
 * - 节点图标选择
 * - 节点颜色设置
 * - 子节点数量验证
 */
export const getNodeType = (def: NodeDef): NodeType => {
  // 转换为小写，便于不区分大小写比较
  const type = def.type.toLocaleLowerCase().toString();
  
  // 使用前缀匹配，兼容 "ActionXXX" 这样的自定义类型
  if (type.startsWith("action")) {
    return "Action";
  } else if (type.startsWith("composite")) {
    return "Composite";
  } else if (type.startsWith("decorator")) {
    return "Decorator";
  } else if (type.startsWith("condition")) {
    return "Condition";
  } else {
    // 未知类型统一归类为 Other
    return "Other";
  }
};
