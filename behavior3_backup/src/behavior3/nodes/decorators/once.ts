import { Blackboard } from "../../blackboard";
import type { Context } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";

export class Once extends Node {
    private _onceKey!: string;

    constructor(context: Context, cfg: NodeData) {
        super(context, cfg);

        this._onceKey = Blackboard.makePrivateVar(this, "ONCE");
    }


    static override get descriptor(): NodeDef {
        return {
            name: "Once",
            type: "Decorator",
            children: 1,
            status: ["success", "failure", "|running"],
            desc: "只执行一次",
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 第一次执行完全部子节点时返回 \`success\`，之后永远返回 \`failure\``,
        };
    }
}
