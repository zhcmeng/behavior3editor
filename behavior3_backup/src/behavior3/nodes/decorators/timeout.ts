import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Stack } from "../../stack";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

interface NodeYield {
    stack: Stack;
    expired: number;
}

export class Timeout extends Node {
    declare args: { readonly time?: number };

    static override get descriptor(): NodeDef {
        return {
            name: "Timeout",
            type: "Decorator",
            children: 1,
            status: ["|success", "|running", "failure"],
            desc: "超时",
            input: ["超时时间?"],
            args: [
                {
                    name: "time",
                    desc: "超时时间",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.FLOAT_OPTIONAL,
                },
            ],
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 当子节点执行超时或返回 \`failure\` 时，返回 \`failure\`
                + 其余情况返回子节点的执行状态
            `,
        };
    }
}
