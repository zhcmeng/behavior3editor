/**
 * 黑板（Blackboard）类型定义导入
 * 
 * Context: 行为树上下文，提供代码编译等功能
 * ObjectType: 对象类型，键值对形式的数据存储
 */
import type { Context, ObjectType } from "./context";
import type { Node } from "./node";
import type { Tree } from "./tree";

/**
 * 私有变量前缀
 * 
 * 用于标识节点的私有变量，格式：__PRIVATE_VAR_NODE#节点ID_变量名
 * 私有变量只能被特定节点访问，不会被其他节点读取或修改
 * 
 * 使用场景：节点需要保存自己的状态，但不想被其他节点影响
 * 例如：装饰器节点记录重复次数、节点记录上次执行时间等
 */
const PREFIX_PRIVATE = "__PRIVATE_VAR";

/**
 * 临时变量前缀
 * 
 * 用于标识节点的临时变量，格式：__TEMP_VAR_NODE#节点ID_变量名
 * 临时变量在行为树执行过程中使用，通常用于节点间传递临时状态
 * 
 * 使用场景：节点需要在执行过程中临时存储数据
 * 例如：Wait 节点记录等待开始时间、Once 节点记录是否已执行等
 */
const PREFIX_TEMP = "__TEMP_VAR";

/**
 * 黑板（Blackboard）类
 * 
 * 黑板模式（Blackboard Pattern）是行为树的核心组件之一，用于：
 * 1. 存储行为树运行时的全局数据（共享内存）
 * 2. 实现节点间的数据共享和通信
 * 3. 管理变量的作用域（全局变量、私有变量、临时变量）
 * 
 * 设计模式：
 * - Blackboard Pattern：多个独立系统通过共享数据区域进行通信
 * - Facade Pattern：提供简单的 get/set 接口，隐藏内部实现
 * 
 * 变量类型：
 * - 全局变量：所有节点都可以访问（普通变量名）
 * - 私有变量：只有特定节点可以访问（__PRIVATE_VAR 前缀）
 * - 临时变量：执行过程中的临时数据（__TEMP_VAR 前缀）
 * 
 * 典型使用场景：
 * ```typescript
 * // AI 角色的黑板
 * blackboard.set("target", enemy);        // 存储当前目标
 * blackboard.set("hp", 100);              // 存储生命值
 * const target = blackboard.get("target"); // 获取目标
 * 
 * // 节点私有变量
 * const counterKey = Blackboard.makePrivateVar(node, "count");
 * blackboard.set(counterKey, 0);  // 存储重复计数
 * ```
 */
export class Blackboard {
    /**
     * 存储所有变量的键值对对象
     * 
     * 结构示例：
     * {
     *   "hp": 100,                                    // 普通变量
     *   "target": { id: 1, name: "enemy" },          // 普通变量
     *   "__PRIVATE_VAR_NODE#123_count": 5,           // 节点私有变量
     *   "__TEMP_VAR_NODE#456_startTime": 1234567890  // 节点临时变量
     * }
     */
    protected _values: ObjectType = {};
    
    /**
     * 关联的行为树对象
     * 
     * 用途：
     * - 访问树的上下文（context）
     * - 通过 context 编译和执行表达式代码
     */
    protected _tree: Tree<Context, unknown>;

    /**
     * 构造函数
     * 
     * @param tree - 关联的行为树实例
     */
    constructor(tree: Tree<Context, unknown>) {
        this._tree = tree;
    }

    /**
     * 获取所有变量（只读访问）
     * 
     * 用途：
     * - 调试时查看所有变量
     * - 序列化黑板状态
     * - 在编辑器中显示变量列表
     * 
     * @returns 包含所有变量的对象
     */
    get values() {
        return this._values;
    }

    /**
     * 执行表达式代码并返回结果
     * 
     * 功能：
     * - 将代码字符串编译为可执行函数
     * - 在黑板变量的上下文中执行代码
     * - 代码可以访问所有黑板变量（作为局部变量）
     * 
     * 使用示例：
     * ```typescript
     * blackboard.set("a", 10);
     * blackboard.set("b", 20);
     * const result = blackboard.eval("a + b");  // 返回 30
     * 
     * blackboard.set("hp", 100);
     * blackboard.set("maxHp", 150);
     * const isDead = blackboard.eval("hp <= 0");  // 返回 false
     * ```
     * 
     * 实现原理：
     * 1. context.compileCode(code) 将代码编译为函数
     * 2. 返回的函数接收变量对象作为参数
     * 3. 函数内部通过 with 语句或参数解构访问变量
     * 
     * @param code - 要执行的 JavaScript 表达式字符串
     * @returns 表达式的执行结果
     */
    eval(code: string) {
        return this._tree.context.compileCode(code)(this._values);
    }

    /**
     * 获取指定键的变量值
     * 
     * 功能：
     * - 类型安全的变量读取
     * - 支持泛型，可以指定返回值类型
     * - 空键返回 undefined
     * 
     * 使用示例：
     * ```typescript
     * // 基本用法
     * const hp = blackboard.get<number>("hp");
     * 
     * // 获取对象
     * interface Enemy { id: number; name: string; }
     * const target = blackboard.get<Enemy>("target");
     * 
     * // 获取私有变量
     * const counterKey = Blackboard.makePrivateVar(node, "count");
     * const count = blackboard.get<number>(counterKey);
     * ```
     * 
     * @template T - 期望的返回值类型
     * @param k - 变量名（键）
     * @returns 变量值，如果不存在或键为空则返回 undefined
     */
    get<T>(k: string): T | undefined {
        if (k) {
            return this._values[k] as T | undefined;
        } else {
            return undefined;
        }
    }

    /**
     * 设置变量值
     * 
     * 功能：
     * - 创建或更新变量
     * - 值为 undefined 或 null 时删除变量（清理内存）
     * - 空键不做任何操作
     * 
     * 设计考虑：
     * - 自动删除 null/undefined 值，避免内存泄漏
     * - 简化了删除操作，不需要单独的 delete 方法
     * 
     * 使用示例：
     * ```typescript
     * // 设置普通变量
     * blackboard.set("hp", 100);
     * blackboard.set("target", { id: 1, name: "enemy" });
     * 
     * // 删除变量（设置为 null 或 undefined）
     * blackboard.set("target", null);  // 删除 target
     * 
     * // 设置私有变量
     * const key = Blackboard.makePrivateVar(node, "count");
     * blackboard.set(key, 5);
     * ```
     * 
     * @param k - 变量名（键）
     * @param v - 变量值（undefined 或 null 会删除该变量）
     */
    set(k: string, v: unknown) {
        if (k) {
            if (v === undefined || v === null) {
                // 删除变量，释放内存
                delete this._values[k];
            } else {
                // 设置或更新变量
                this._values[k] = v;
            }
        }
    }

    /**
     * 清空所有变量
     * 
     * 用途：
     * - 重置黑板状态
     * - 行为树重新开始时清理数据
     * - 释放内存
     * 
     * 注意：
     * - 会删除所有变量，包括全局变量、私有变量、临时变量
     * - 通常在行为树执行完毕后调用
     * 
     * 使用示例：
     * ```typescript
     * // 重置 AI 状态
     * blackboard.clear();
     * blackboard.set("hp", maxHp);  // 重新初始化
     * ```
     */
    clear() {
        this._values = {};
    }

    /**
     * 创建私有变量名（函数重载 1）
     * 
     * 用于创建简单的私有变量名，不关联特定节点
     * 
     * @param k - 变量名
     * @returns 带私有前缀的变量名：__PRIVATE_VAR_变量名
     */
    static makePrivateVar(k: string): string;

    /**
     * 创建节点私有变量名（函数重载 2）
     * 
     * 用于创建关联到特定节点的私有变量
     * 
     * @param node - 节点实例
     * @param k - 变量名
     * @returns 带节点ID的私有变量名：__PRIVATE_VAR_NODE#节点ID_变量名
     */
    static makePrivateVar(node: Node, k: string): string;

    /**
     * 创建私有变量名（实现）
     * 
     * 功能：
     * - 生成带有特殊前缀的变量名，确保不会与普通变量冲突
     * - 支持两种模式：简单私有变量 / 节点私有变量
     * 
     * 设计目的：
     * - 节点可以存储自己的私有状态，不被其他节点干扰
     * - 即使多个节点使用相同的变量名，也不会冲突
     * 
     * 生成格式：
     * - 简单模式：__PRIVATE_VAR_变量名
     * - 节点模式：__PRIVATE_VAR_NODE#节点ID_变量名
     * 
     * 使用示例：
     * ```typescript
     * // 节点私有变量（推荐）
     * class RepeatNode extends Node {
     *   run() {
     *     const counterKey = Blackboard.makePrivateVar(this, "count");
     *     let count = this.blackboard.get<number>(counterKey) || 0;
     *     count++;
     *     this.blackboard.set(counterKey, count);
     *   }
     * }
     * 
     * // 简单私有变量
     * const key = Blackboard.makePrivateVar("globalCounter");
     * blackboard.set(key, 0);
     * ```
     * 
     * @param node - 节点实例或简单变量名
     * @param k - 变量名（仅在 node 为 Node 实例时需要）
     * @returns 格式化的私有变量名
     */
    static makePrivateVar(node: Node | string, k?: string) {
        if (typeof node === "string") {
            // 简单模式：__PRIVATE_VAR_变量名
            return `${PREFIX_PRIVATE}_${node}`;
        } else {
            // 节点模式：__PRIVATE_VAR_NODE#节点ID_变量名
            return `${PREFIX_PRIVATE}_NODE#${node.id}_${k}`;
        }
    }

    /**
     * 判断是否为私有变量
     * 
     * 用途：
     * - 在编辑器中过滤私有变量（可能不需要显示）
     * - 序列化时区分变量类型
     * - 调试时识别变量作用域
     * 
     * @param k - 变量名
     * @returns 如果是私有变量返回 true，否则返回 false
     */
    static isPrivateVar(k: string) {
        return k.startsWith(PREFIX_PRIVATE);
    }

    /**
     * 创建临时变量名
     * 
     * 功能：
     * - 生成节点专用的临时变量名
     * - 临时变量用于节点运行时的中间状态
     * 
     * 与私有变量的区别：
     * - 私有变量：持久化的节点状态（如计数器）
     * - 临时变量：临时的执行状态（如等待开始时间、yield 标记）
     * 
     * 生成格式：
     * - __TEMP_VAR_NODE#节点ID_变量名
     * 
     * 使用示例：
     * ```typescript
     * // Wait 节点记录等待开始时间
     * class WaitNode extends Node {
     *   run() {
     *     const startTimeKey = Blackboard.makeTempVar(this, "startTime");
     *     let startTime = this.blackboard.get<number>(startTimeKey);
     *     
     *     if (!startTime) {
     *       // 第一次执行，记录开始时间
     *       this.blackboard.set(startTimeKey, Date.now());
     *       return "running";
     *     }
     *     
     *     // 检查是否超时
     *     if (Date.now() - startTime > this.duration) {
     *       this.blackboard.set(startTimeKey, null);  // 清理临时变量
     *       return "success";
     *     }
     *     
     *     return "running";
     *   }
     * }
     * ```
     * 
     * @param node - 节点实例
     * @param k - 变量名
     * @returns 格式化的临时变量名：__TEMP_VAR_NODE#节点ID_变量名
     */
    static makeTempVar(node: Node, k: string) {
        return `${PREFIX_TEMP}_NODE#${node.id}_${k}`;
    }

    /**
     * 判断是否为临时变量
     * 
     * 用途：
     * - 调试时区分变量类型
     * - 清理临时数据时识别临时变量
     * - 序列化时可能需要跳过临时变量
     * 
     * @param k - 变量名
     * @returns 如果是临时变量返回 true，否则返回 false
     */
    static isTempVar(k: string) {
        return k.startsWith(PREFIX_TEMP);
    }
}
