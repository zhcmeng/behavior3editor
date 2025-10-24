import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Index extends Node {
    declare input: [unknown[], number | undefined];
    declare args: { readonly index: number };



    static override get descriptor(): NodeDef {
        return {
            name: "Index",
            type: "Action",
            children: 0,
            status: ["success", "failure"],
            desc: "索引输入的数组",
            args: [
                {
                    name: "index",
                    desc: "索引",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.INT_OPTIONAL,
                },
            ],
            input: ["数组", "索引?"],
            output: ["值"],
            doc: `
                + 合法元素不包括 \`undefined\` 和 \`null\`
                + 索引数组的时候，第一个元素的索引为 0
                + 只有索引到有合法元素时候才会返回 \`success\`，否则返回 \`failure\`
            `,
        };
    }
}
