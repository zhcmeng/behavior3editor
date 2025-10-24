import type { Context } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";

/**
 * Switch node that executes cases in order until one matches.
 *
 * Each child must be a Case node with exactly 2 children:
 * 1. The condition node that determines if this case matches
 * 2. The action node to execute if condition returns `success`
 *
 * The execution flow is:
 * 1. Execute first child (condition) of each case in order
 * 2. If condition returns `success`, execute second child (action)
 * 3. Return the status of the action node
 * 4. If no case matches, return `failure`
 *
 * Similar to a switch statement, cases are evaluated in order
 * until a matching condition is found. Only the action of the
 * first matching case is executed.
 */
export class Switch extends Node {
    constructor(context: Context, cfg: NodeData) {
        super(context, cfg);

        this.children.forEach((v) => {
            if (v.name !== "Case") {
                this.throw(`only allow Case node`);
            }
        });
    }

    static override get descriptor(): NodeDef {
        return {
            name: "Switch",
            type: "Composite",
            children: -1,
            status: ["|success", "|failure", "|running"],
            desc: "分支执行",
            doc: `
                + 按顺序测试 \`Case\` 节点的判断条件（第一个子节点）
                + 若测试返回 \`success\` 则执行 \`Case\` 第二个子节点，并返回子节点的执行状态
                + 若没有判断为 \`success\` 的 \`Case\` 节点，则返回 \`failure\`
            `,
        };
    }
}

export class Case extends Node {


    static override get descriptor(): NodeDef {
        return {
            name: "Case",
            type: "Composite",
            children: 2,
            status: ["&success", "|failure", "|running"],
            desc: "分支选择",
            doc: `
                + 必须有两个子节点
                + 第一个子节点为判断条件
                + 第二个子节点为判断为 \`success\` 时执行的节点
                + 此节点不会真正意义的执行，而是交由 \`Switch\` 节点来执行
            `,
        };
    }
}
