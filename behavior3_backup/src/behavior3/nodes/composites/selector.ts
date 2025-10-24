import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";

/**
 * Selector composite node that executes children in order.
 * Returns:
 * - `success`: if any child returns `success`
 * - `failure`: when all children return `failure`
 * - `running`: if a child returns `running`
 *
 * Executes children sequentially until one succeeds or all fail.
 * If a child returns `running`, the selector will yield and resume
 * from that child on next tick.
 */
export class Selector extends Node {


    static override get descriptor(): NodeDef {
        return {
            name: "Selector",
            type: "Composite",
            children: -1,
            desc: "选择执行",
            status: ["|success", "&failure", "|running"],
            doc: `
                + 一直往下执行，直到有子节点返回 \`success\` 则返回 \`success\`
                + 若全部节点返回 \`failure\` 则返回 \`failure\``,
        };
    }
}
