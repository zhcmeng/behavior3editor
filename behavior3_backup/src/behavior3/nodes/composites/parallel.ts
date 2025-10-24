import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Stack } from "../../stack";
import { Tree } from "../../tree";

const EMPTY_STACK: Stack = new Stack(null!);

/**
 * Parallel node executes all child nodes simultaneously.
 *
 * The execution flow is:
 * 1. Execute all child nodes in parallel
 * 2. If any child returns `running`, store its state and continue next tick
 * 3. Return `running` until all children complete
 * 4. When all children complete, return `success`
 *
 * Each child's execution state is tracked independently, allowing true parallel behavior.
 * The node only succeeds when all children have completed successfully.
 */
export class Parallel extends Node {


    static override get descriptor(): NodeDef {
        return {
            name: "Parallel",
            type: "Composite",
            status: ["success", "|running"],
            children: -1,
            desc: "并行执行",
            doc: `
                + 并行执行所有子节点
                + 当有子节点返回 \`running\` 时，返回 \`running\` 状态
                + 执行完所有子节点后，返回 \`success\``,
        };
    }
}
