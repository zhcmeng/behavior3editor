/**
 * 行为树核心模块导入
 * 
 * Blackboard: 黑板，用于存储和共享数据
 * Context: 上下文，提供运行环境和工具方法
 * Node: 节点基类和相关类型
 * Stack: 栈，用于管理节点执行顺序
 */
import { Blackboard } from "./blackboard";
import { Context } from "./context";
import { Node, NodeData, Status } from "./node";
import { Stack } from "./stack";

/**
 * 行为树数据结构
 * 
 * 定义了行为树的 JSON 存储格式，用于：
 * - 从文件加载行为树配置
 * - 序列化和保存行为树
 * - 在编辑器中编辑行为树
 * 
 * 示例 JSON：
 * ```json
 * {
 *   "name": "monster_ai",
 *   "desc": "怪物AI行为树",
 *   "root": {
 *     "id": "1",
 *     "name": "Sequence",
 *     "desc": "巡逻序列",
 *     "children": [...]
 *   }
 * }
 * ```
 */
export interface TreeData {
    /** 行为树名称，通常用作文件名 */
    readonly name: string;
    /** 行为树描述，说明用途 */
    readonly desc: string;
    /** 根节点数据，包含整个树的结构 */
    readonly root: NodeData;
}

/**
 * 行为树事件枚举
 * 
 * 定义了行为树生命周期中触发的各种事件，用于：
 * - 监听行为树状态变化
 * - 实现调试和日志功能
 * - 触发游戏逻辑（如播放动画、音效等）
 * 
 * 事件顺序（正常执行）：
 * 1. BEFORE_TICKED - tick 开始前
 * 2. AFTER_TICKED - tick 结束后
 * 3. TICKED_SUCCESS 或 TICKED_FAILURE - 根据结果触发
 * 
 * 使用示例：
 * ```typescript
 * tree.context.on(TreeEvent.TICKED_SUCCESS, (tree) => {
 *   console.log(`行为树 ${tree.path} 执行成功`);
 * });
 * ```
 */
export const enum TreeEvent {
    /** 行为树被清理（调用 clear() 时触发） */
    CLEANED = "treeCleaned",
    /** 行为树被中断（调用 interrupt() 时触发） */
    INTERRUPTED = "treeInterrupted",
    /** 行为树开始执行（每次 tick 开始前触发） */
    BEFORE_TICKED = "treeBeforeTicked",
    /** 行为树执行完成（tick 结束后触发，无论成功或失败） */
    AFTER_TICKED = "treeAfterTicked",
    /** 行为树执行成功（status 为 success 时触发） */
    TICKED_SUCCESS = "treeTickedSuccess",
    /** 行为树执行失败（status 为 failure 时触发） */
    TICKED_FAILURE = "treeTickedFailure",
}

/**
 * 行为树状态类型
 * 
 * 扩展了节点状态，增加了 "interrupted" 状态
 * 
 * 状态说明：
 * - "success": 执行成功
 * - "failure": 执行失败
 * - "running": 正在执行（异步操作、等待条件等）
 * - "interrupted": 被中断（手动停止或异常）
 */
export type TreeStatus = Status | "interrupted";

/**
 * 全局行为树 ID 计数器
 * 
 * 用于为每个行为树实例生成唯一 ID
 * 每次创建新的 Tree 实例时自增
 */
let treeId = 0;

/**
 * 行为树类
 * 
 * 行为树的核心执行引擎，负责：
 * 1. 管理节点的执行流程（tick 机制）
 * 2. 维护执行状态和上下文
 * 3. 处理中断和恢复
 * 4. 管理黑板（数据共享）和栈（执行顺序）
 * 5. 发送生命周期事件
 * 
 * 泛型参数：
 * @template C - Context 类型，提供运行环境
 * @template Owner - 拥有者类型，通常是游戏实体（如角色、怪物）
 * 
 * 核心概念：
 * - **Tick**: 行为树的执行单元，每次调用 tick() 执行一次
 * - **Running**: 节点返回 running 时会保存状态，下次 tick 继续执行
 * - **Interrupt**: 中断正在执行的行为树，清理临时状态
 * - **Yield/Resume**: 协程机制，节点可以暂停并传递数据
 * 
 * 使用示例：
 * ```typescript
 * // 创建行为树
 * const tree = new Tree(context, monster, "monster_ai");
 * 
 * // 游戏循环中执行
 * function update() {
 *   const status = tree.tick();
 *   if (status === "success") {
 *     console.log("AI 执行完成");
 *   } else if (status === "running") {
 *     console.log("AI 正在执行");
 *   }
 * }
 * 
 * // 中断行为树
 * tree.interrupt();
 * 
 * // 清理行为树
 * tree.clear();
 * ```
 */
export class Tree<C extends Context, Owner> {
    /** 上下文对象，提供运行环境、节点注册、事件系统等 */
    readonly context: C;
    
    /** 行为树的拥有者，通常是游戏实体（角色、怪物、NPC 等） */
    readonly owner: Owner;
    
    /** 行为树文件路径，用于加载和标识行为树 */
    readonly path: string;
    
    /** 黑板，存储和共享行为树运行时的数据 */
    readonly blackboard: Blackboard;
    
    /** 栈，管理节点的执行顺序（用于处理 running 状态的恢复） */
    readonly stack: Stack;
    
    /** 行为树唯一 ID，用于调试和日志 */
    readonly id: number = ++treeId;

    /** 调试模式，开启后会输出详细的执行日志 */
    debug: boolean = false;

    /**
     * 是否正在执行 tick
     * 
     * 用途：
     * - 防止重入（一个 tick 执行期间不能再次调用 tick）
     * - 在 tick 执行期间设置中断标志，tick 结束后再执行中断
     */
    protected _ticking: boolean = false;

    /**
     * 上次执行的状态
     * 
     * @private 内部使用，用于节点判断子节点的执行结果
     */
    __lastStatus: Status = "success";

    /**
     * 中断标志
     * 
     * @private 内部使用，标记是否需要中断
     * 
     * 设计考虑：
     * - 在 tick 执行期间不能立即中断（可能导致状态不一致）
     * - 设置标志后，在 tick 结束时执行中断操作
     */
    __interrupted: boolean = false;

    /** 根节点，行为树的入口 */
    private _root?: Node;
    
    /** 当前行为树的状态 */
    private _status: TreeStatus = "success";

    /**
     * 构造函数
     * 
     * 创建行为树实例并初始化各个组件：
     * 1. 保存上下文、拥有者和路径
     * 2. 创建黑板（数据存储）
     * 3. 创建栈（执行顺序管理）
     * 4. 加载行为树配置
     * 
     * @param context - 上下文对象
     * @param owner - 拥有者对象（游戏实体）
     * @param path - 行为树文件路径
     * 
     * 示例：
     * ```typescript
     * const tree = new Tree(
     *   gameContext,           // 游戏上下文
     *   monsterEntity,         // 怪物实体
     *   "behaviors/monster.json"  // 行为树文件
     * );
     * ```
     */
    constructor(context: C, owner: Owner, path: string) {
        this.context = context;
        this.owner = owner;
        this.path = path;
        this.blackboard = new Blackboard(this);
        this.stack = new Stack(this);
        this.context.loadTree(this.path);
    }

    /**
     * 获取根节点
     * 
     * 使用懒加载模式：
     * - 第一次访问时从 context.trees 中获取
     * - 之后返回缓存的节点
     * 
     * 为什么懒加载：
     * - 行为树文件可能是异步加载的
     * - 构造函数时文件可能还未加载完成
     * 
     * @returns 根节点，如果未加载则返回 undefined
     */
    get root(): Node | undefined {
        return (this._root ||= this.context.trees[this.path]);
    }

    /**
     * 行为树是否已准备好执行
     * 
     * 条件：
     * - 根节点已加载
     * - 可以开始调用 tick()
     * 
     * 使用示例：
     * ```typescript
     * if (tree.ready) {
     *   tree.tick();
     * } else {
     *   console.log("行为树还未加载完成");
     * }
     * ```
     * 
     * @returns 如果根节点存在返回 true，否则返回 false
     */
    get ready() {
        return !!this.root;
    }

    /**
     * 获取当前行为树状态
     * 
     * @returns 当前状态：success | failure | running | interrupted
     */
    get status() {
        return this._status;
    }

    /**
     * 是否正在执行 tick
     * 
     * @returns 如果正在执行返回 true，否则返回 false
     */
    get ticking() {
        return this._ticking;
    }

    /**
     * 清理行为树
     * 
     * 完全重置行为树到初始状态：
     * 1. 发送 CLEANED 事件（通知监听者）
     * 2. 中断当前执行
     * 3. 重置所有状态
     * 4. 清空栈和黑板
     * 5. 移除所有事件监听器
     * 
     * 使用场景：
     * - 角色死亡，重置 AI
     * - 切换到新的行为树
     * - 释放资源
     * 
     * 注意：
     * - 会丢失所有黑板数据
     * - 会清理所有临时状态
     * - 需要重新设置初始变量
     * 
     * 使用示例：
     * ```typescript
     * // 角色死亡，清理 AI
     * if (character.isDead) {
     *   tree.clear();
     * }
     * 
     * // 切换行为树
     * oldTree.clear();
     * const newTree = new Tree(context, owner, "new_behavior.json");
     * ```
     */
    clear() {
        // 强制运行清理逻辑，暂时清除中断标志
        const interrupted = this.__interrupted;
        this.__interrupted = false;
        this.context.dispatch(TreeEvent.CLEANED, this);
        this.__interrupted = interrupted;

        // 中断执行
        this.interrupt();
        
        // 重置状态
        this.debug = false;
        this.__interrupted = false;
        this._status = "success";
        
        // 清空数据
        this.stack.clear();
        this.blackboard.clear();
        
        // 移除事件监听
        this.context.offAll(this);
    }

    /**
     * 中断行为树执行
     * 
     * 功能：
     * - 停止当前正在执行的行为
     * - 清理临时变量
     * - 清空执行栈
     * - 将状态设置为 "interrupted"
     * 
     * 中断时机：
     * - 如果正在 ticking，设置标志，tick 结束后执行中断
     * - 如果不在 ticking，立即执行中断
     * 
     * 使用场景：
     * - 玩家手动操作（打断 AI 控制）
     * - 接收到更高优先级的命令
     * - 异常情况需要停止当前行为
     * 
     * 使用示例：
     * ```typescript
     * // 玩家发出新指令，打断当前 AI
     * if (receivedPlayerCommand) {
     *   aiTree.interrupt();
     *   // 执行新指令
     * }
     * 
     * // 角色被眩晕，中断所有行为
     * if (character.isStunned) {
     *   tree.interrupt();
     * }
     * ```
     * 
     * 中断后的状态：
     * - tree.status === "interrupted"
     * - tree.stack.length === 0
     * - 临时变量被清理
     * - 私有变量和全局变量保留
     */
    interrupt() {
        if (this._status === "running" || this._ticking) {
            // 发送中断事件
            this.context.dispatch(TreeEvent.INTERRUPTED, this);
            
            // 设置中断标志
            this.__interrupted = true;
            
            // 如果不在 ticking，立即执行中断
            if (!this._ticking) {
                this._doInterrupt();
            }
            // 否则在 tick 结束后执行（见 tick() 方法末尾）
        }
    }

    /**
     * Yield 机制 - 节点暂停并传递值
     * 
     * 功能：
     * - 节点返回 running 状态
     * - 将值存储到黑板的临时变量中
     * - 下次 tick 时可以通过 resume() 获取该值
     * 
     * 设计目的：
     * - 实现协程（coroutine）机制
     * - 节点可以暂停执行，保存中间状态
     * - 支持异步操作（如等待事件、动画等）
     * 
     * 使用场景：
     * - 等待动画播放完成
     * - 等待事件触发
     * - 分帧执行复杂计算
     * 
     * 使用示例：
     * ```typescript
     * class WaitForEventNode extends Node {
     *   run(tree: Tree) {
     *     const resumed = tree.resume<boolean>(this);
     *     
     *     if (resumed) {
     *       // 事件已触发，继续执行
     *       return "success";
     *     }
     *     
     *     // 等待事件
     *     listenEvent(() => {
     *       tree.yield(this, true);  // 事件触发，设置标志
     *     });
     *     
     *     return tree.yield(this);  // 暂停，返回 running
     *   }
     * }
     * ```
     * 
     * @template V - 传递的值类型
     * @param node - 调用 yield 的节点
     * @param value - 要传递的值，默认为 true
     * @returns 始终返回 "running"
     */
    yield<V = unknown>(node: Node, value?: V): Status {
        this.blackboard.set(node.__yield, value ?? true);
        return "running";
    }

    /**
     * Resume 机制 - 恢复节点并获取 yield 的值
     * 
     * 功能：
     * - 获取节点上次 yield 时存储的值
     * - 配合 yield 实现协程
     * 
     * 返回值：
     * - 如果节点之前调用了 yield，返回存储的值
     * - 如果没有调用过 yield，返回 undefined
     * 
     * 使用示例：
     * ```typescript
     * class AsyncNode extends Node {
     *   run(tree: Tree) {
     *     const result = tree.resume<number>(this);
     *     
     *     if (result !== undefined) {
     *       // 恢复执行，使用之前的结果
     *       console.log("异步操作完成，结果:", result);
     *       return "success";
     *     }
     *     
     *     // 首次执行，启动异步操作
     *     startAsyncOperation((result) => {
     *       tree.yield(this, result);  // 完成后存储结果
     *     });
     *     
     *     return "running";
     *   }
     * }
     * ```
     * 
     * @template V - 期望的值类型
     * @param node - 要恢复的节点
     * @returns 之前 yield 的值，如果没有则返回 undefined
     */
    resume<V = unknown>(node: Node): V | undefined {
        return this.blackboard.get(node.__yield) as V;
    }

    /**
     * 执行行为树（Tick）
     * 
     * Tick 是行为树的核心执行机制：
     * - 每次调用执行一轮行为树
     * - 从根节点开始，递归执行子节点
     * - 如果返回 running，下次 tick 从上次暂停的地方继续
     * 
     * 执行流程：
     * 
     * 1. **检查准备状态**
     *    - 根节点是否已加载
     *    - 是否正在执行（防止重入）
     * 
     * 2. **执行节点**
     *    - 如果栈不为空：从栈顶恢复执行（running 状态恢复）
     *    - 如果栈为空：从根节点开始执行
     * 
     * 3. **处理结果**
     *    - success：发送成功事件，清空栈
     *    - failure：发送失败事件，清空栈
     *    - running：保持栈状态，下次继续
     * 
     * 4. **处理中断**
     *    - 如果设置了中断标志，执行中断操作
     * 
     * 状态转换：
     * ```
     * success/failure ──┐
     *                   ├──> 下次从根节点开始
     * interrupted ──────┘
     * 
     * running ──> 下次从栈顶节点继续
     * ```
     * 
     * 使用示例：
     * ```typescript
     * // 游戏主循环
     * function gameLoop() {
     *   const status = aiTree.tick();
     *   
     *   if (status === "running") {
     *     console.log("AI 正在执行中");
     *   } else if (status === "success") {
     *     console.log("AI 执行完成");
     *   } else if (status === "failure") {
     *     console.log("AI 执行失败");
     *   } else if (status === "interrupted") {
     *     console.log("AI 被中断");
     *   }
     * }
     * 
     * // 每帧调用
     * setInterval(gameLoop, 16);
     * ```
     * 
     * 错误处理：
     * - 如果根节点未加载，返回 "failure"
     * - 如果重入调用（正在 ticking），抛出错误
     * 
     * @returns 行为树的执行状态
     * @throws {Error} 如果在 tick 执行期间再次调用 tick
     */
    tick(): TreeStatus {
        const { context, stack, root } = this;

        // 检查根节点是否已加载
        if (!root) {
            return "failure";
        }

        // 调试输出
        if (this.debug) {
            console.debug(`---------------- debug ai: ${this.path} --------------------`);
        }

        // 防止重入
        if (this._ticking) {
            const node = stack.top();
            throw new Error(`tree '${this.path}' already ticking: ${node?.name}#${node?.id}`);
        }

        // 标记正在执行
        this._ticking = true;

        // 执行节点
        if (stack.length > 0) {
            // 栈不为空：恢复执行（处理 running 状态）
            let node = stack.top();
            while (node) {
                this._status = node.tick(this);
                if (this._status === "running") {
                    // 节点返回 running，保持栈状态，等待下次 tick
                    break;
                } else {
                    // 节点执行完成，继续执行栈顶节点
                    node = stack.top();
                }
            }
        } else {
            // 栈为空：从根节点开始执行
            context.dispatch(TreeEvent.BEFORE_TICKED, this);
            this._status = root.tick(this);
        }

        // 处理执行结果，发送事件
        if (this._status === "success") {
            context.dispatch(TreeEvent.AFTER_TICKED, this);
            context.dispatch(TreeEvent.TICKED_SUCCESS, this);
        } else if (this._status === "failure") {
            context.dispatch(TreeEvent.AFTER_TICKED, this);
            context.dispatch(TreeEvent.TICKED_FAILURE, this);
        }

        // 处理中断（如果在执行期间设置了中断标志）
        if (this.__interrupted) {
            this._doInterrupt();
        }

        // 标记执行完成
        this._ticking = false;

        return this._status;
    }

    /**
     * 执行中断操作（私有方法）
     * 
     * 内部实现中断逻辑：
     * 1. 设置状态为 "interrupted"
     * 2. 清空执行栈
     * 3. 清理所有临时变量（保留私有变量和全局变量）
     * 4. 清除中断标志
     * 
     * 变量清理策略：
     * - 临时变量（__TEMP_VAR_*）：删除
     * - 私有变量（__PRIVATE_VAR_*）：保留
     * - 全局变量：保留
     * 
     * 为什么清理临时变量：
     * - 临时变量用于执行过程中的中间状态
     * - 中断后这些状态已无效
     * - 清理可以避免下次执行时使用过期数据
     * 
     * 为什么保留其他变量：
     * - 私有变量：节点的持久状态（如计数器）
     * - 全局变量：游戏状态（如 HP、位置等）
     * 
     * 调用时机：
     * - interrupt() 方法中（如果不在 ticking）
     * - tick() 方法末尾（如果设置了中断标志）
     */
    private _doInterrupt() {
        const values = this.blackboard.values;
        
        // 设置状态为中断
        this._status = "interrupted";
        
        // 清空执行栈
        this.stack.clear();
        
        // 清理临时变量
        for (const key in values) {
            if (Blackboard.isTempVar(key)) {
                delete values[key];
            }
        }
        
        // 清除中断标志
        this.__interrupted = false;
    }
}
