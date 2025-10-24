import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";

export class Invert extends Node {

    private _invert(status: Status): Status {
        return status === "failure" ? "success" : "failure";
    }

    static override get descriptor(): NodeDef {
        return {
            name: "Invert",
            type: "Decorator",
            children: 1,
            status: ["!success", "!failure", "|running"],
            desc: "反转子节点运行结果",
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 当子节点返回 \`success\` 时返回 \`failure\`
                + 当子节点返回 \`failure\` 时返回 \`success\`
            `,
        };
    }
}
