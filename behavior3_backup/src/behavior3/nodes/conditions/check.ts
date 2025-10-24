import type { Context } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Check extends Node {
    declare args: { readonly value: string };

    constructor(context: Context, cfg: NodeData) {
        super(context, cfg);

        if (typeof this.args.value !== "string" || this.args.value.length === 0) {
            this.throw(`args.value is not a expr string`);
        }
        context.compileCode(this.args.value);
    }



    static override get descriptor(): NodeDef {
        return {
            name: "Check",
            type: "Condition",
            children: 0,
            status: ["success", "failure"],
            desc: "检查True或False",
            args: [
                {
                    name: "value",
                    desc: "值",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.EXPR,
                }
            ],
            doc: `
                + 做简单数值公式判定，返回 \`success\` 或 \`failure\`
            `,
        };
    }
}
