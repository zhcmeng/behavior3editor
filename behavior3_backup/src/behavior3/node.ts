import type { VarDecl } from "../../../misc/b3type";
import { Blackboard } from "./blackboard";
import type { Context, DeepReadonly, NodeContructor, ObjectType } from "./context";
import type { Tree, TreeData } from "./tree";

export type Status = "success" | "failure" | "running";

export interface NodeDef<GroupType extends string = string> {
    name: string;
    /**
     * Recommended type used for the node definition:
     * + `Action`: No children allowed, returns `success`, `failure` or `running`.
     * + `Decorator`: Only one child allowed, returns `success`, `failure` or `running`.
     * + `Composite`: Contains more than one child, returns `success`, `failure` or `running`.
     * + `Condition`: No children allowed, no output, returns `success` or `failure`.
     */
    type: "Action" | "Decorator" | "Condition" | "Composite";
    desc: string;
    /** ["input1?", "input2..."] */
    input?: string[];
    /** ["output1", "output2..."] */
    output?: string[];
    args?: VarDecl[];
    doc?: string;
    icon?: string;
    color?: string;
    /**
     * Used in Behavior3 Editor, to help editor manage available nodes in file tree.
     */
    group?: GroupType[];
    /**
     * Used in Behavior3 Editor, to help editor deduce the status of the node.
     *
     * + `!success`  !(child_success|child_success|...)
     * + `!failure`  !(child_failure|child_failure|...)
     * + `|success`  child_success|child_success|...
     * + `|failure`  child_failure|child_failure|...
     * + `|running`  child_running|child_running|...
     * + `&success`  child_success&child_success&...
     * + `&failure`  child_failure&child_failure&...
     */
    status?: (
        | "success"
        | "failure"
        | "running"
        | "!success"
        | "!failure"
        | "|success"
        | "|failure"
        | "|running"
        | "&success"
        | "&failure"
    )[];
    /**
     * Used in Behavior3 Editor, to help editor alert error when the num of children is wrong.
     *
     * Allowed number of children
     * + -1: unlimited
     * + 0: no children
     * + 1: exactly one
     * + 2: exactly two (case)
     * + 3: exactly three children (ifelse)
     */
    children?: -1 | 0 | 1 | 2 | 3;
}

export interface NodeData {
    id: string;
    name: string;
    desc: string;
    args: { [k: string]: unknown };
    debug?: boolean;
    disabled?: boolean;
    input: string[];
    output: string[];
    children: NodeData[];

    tree: TreeData;
}

export abstract class Node {
    readonly args: unknown = {};
    readonly input: unknown[] = [];
    readonly output: unknown[] = [];

    active: boolean;

    protected readonly _context: Context;

    private _parent: Node | null = null;
    private _children: Node[] = [];
    private _cfg: DeepReadonly<NodeData>;
    private _yield?: string;
    private _argObjectKeys: Record<string, string> = {};

    constructor(context: Context, cfg: NodeData) {
        this._context = context;
        this._cfg = cfg;
        this.active = !cfg.disabled;
        Object.keys(cfg.args).forEach((k) => {
            const value = cfg.args[k];
            if (value && typeof value === "object") {
                this._argObjectKeys[k] = JSON.stringify(value);
            } else {
                (this.args as ObjectType)[k] = value;
            }
        });

        for (const childCfg of cfg.children) {
            if (!childCfg.disabled) {
                const child = Node.create(context, childCfg);
                child._parent = this;
                this._children.push(child);
            }
        }
    }

    /** @private */
    get __yield() {
        return (this._yield ||= Blackboard.makeTempVar(this, "YIELD"));
    }

    get cfg() {
        return this._cfg;
    }

    get id() {
        return this.cfg.id;
    }

    get name() {
        return this.cfg.name;
    }

    get parent() {
        return this._parent;
    }

    get children(): Readonly<Node[]> {
        return this._children;
    }

    private _tryTick(tree: Tree<Context, unknown>) {
        return "success";
    }

    tick(tree: Tree<Context, unknown>): Status {
        return "success"
    }

    assert(condition: unknown, msg: string): asserts condition {
        if (!condition) {
            this.throw(msg);
        }
    }

    /**
     * throw an error
     */
    throw(msg: string): never {
        throw new Error(`${this.cfg.tree.name}->${this.name}#${this.id}: ${msg}`);
    }

    /**
     * use console.error to print error message
     */
    error(msg: string) {
        console.error(`${this.cfg.tree.name}->${this.name}#${this.id}: ${msg}`);
    }

    /**
     * use console.warn to print warning message
     */
    warn(msg: string) {
        console.warn(`${this.cfg.tree.name}->${this.name}#${this.id}: ${msg}`);
    }

    /**
     * use console.debug to print debug message
     */
    debug(msg: string) {
        console.debug(`${this.cfg.tree.name}->${this.name}#${this.id}: ${msg}`);
    }

    /**
     * use console.info to print info message
     */

    info(msg: string) {
        console.info(`${this.cfg.tree.name}->${this.name}#${this.id}: ${msg}`);
    }

    /**
     * Executes the node's behavior tree logic.
     * @param tree The behavior tree instance
     * @param status The status of the last node
     * @returns The execution status: `success`, `failure`, or `running`
     */
    onTick(tree: Tree<Context, unknown>, status: Status): Status {
        return "success";
    }

    static get descriptor(): NodeDef {
        throw new Error(`descriptor not found in '${this.name}'`);
    }

    static create(context: Context, cfg: NodeData) {
        const NodeCls = context.nodeCtors[cfg.name] as NodeContructor<Node> | undefined;
        const descriptor = context.nodeDefs[cfg.name] as NodeDef | undefined;

        if (!NodeCls || !descriptor) {
            throw new Error(`behavior3: node '${cfg.tree.name}->${cfg.name}' is not registered`);
        }

        const node = new NodeCls(context, cfg);

        if (node.tick !== Node.prototype.tick) {
            throw new Error("don't override 'tick' function");
        }

        if (
            descriptor.children !== undefined &&
            descriptor.children !== -1 &&
            descriptor.children !== node.children.length
        ) {
            if (descriptor.children === 0) {
                node.warn(`no children is required`);
            } else if (node.children.length < descriptor.children) {
                node.throw(`at least ${descriptor.children} children are required`);
            } else {
                node.warn(`exactly ${descriptor.children} children`);
            }
        }

        return node;
    }
}
