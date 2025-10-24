import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Repeat extends Node {
    declare args: { readonly count: number };

    static override get descriptor(): NodeDef {
        return {
            name: "Repeat",
            type: "Decorator",
            children: 1,
            status: ["success", "|running", "|failure"],
            desc: "循环执行",
            input: ["循环次数?"],
            args: [
                {
                    name: "count",
                    desc: "循环次数",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.INT_OPTIONAL,
                },
            ],
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 当子节点返回 \`failure\` 时，退出遍历并返回 \`failure\` 状态
                + 执行完所有子节点后，返回 \`success\`
            `,
        };
    }
}
