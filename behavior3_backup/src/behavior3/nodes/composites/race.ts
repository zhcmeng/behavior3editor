import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Stack } from "../../stack";
import { Tree } from "../../tree";

const EMPTY_STACK: Stack = new Stack(null!);

/**
 * Race node executes all child nodes simultaneously until one succeeds or all fail.
 *
 * The execution flow is:
 * 1. Execute all child nodes in parallel
 * 2. If any child returns `success`, immediately return `success` and cancel other running children
 * 3. If any child returns `running`, store its state and continue next tick
 * 4. Return `failure` only when all children have failed
 *
 * Each child's execution state is tracked independently, allowing parallel execution.
 * The first child to succeed "wins the race" and causes the node to succeed.
 * The node only fails if all children fail.
 */
export class Race extends Node {

    static override get descriptor(): NodeDef {
        return {
            name: "Race",
            type: "Composite",
            status: ["|success", "&failure", "|running"],
            children: -1,
            desc: "竞争执行",
            doc: `
                + 并行执行所有子节点
                + 当有子节点返回 \`success\` 时，立即返回 \`success\` 状态，并中断其他子节点
                + 如果所有子节点返回 \`failure\` 则返回 \`failure\``,
        };
    }
}
