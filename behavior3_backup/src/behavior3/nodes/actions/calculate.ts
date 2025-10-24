import type { Context } from "../../context";
import { Node, NodeDef, NodeData, Status } from "../../node";
import { Tree } from "../../tree";
import { VarType, ValueType } from "../../../../../misc/b3type";

export class Calculate extends Node {
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
            name: "Calculate",
            type: "Action",
            children: 0,
            status: ["success"],
            desc: "简单的数值公式计算",
            args: [
                {
                    name: "value",
                    desc: "计算公式",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.EXPR,
                }
            ],
            output: ["计算结果"],
            doc: `
                + 做简单的数值公式计算，返回结果到输出
            `,
        };
    }
}
