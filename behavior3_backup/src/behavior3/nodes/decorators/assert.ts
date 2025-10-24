import type { Context } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Assert extends Node {
    declare args: { readonly message: string };

    static override get descriptor(): NodeDef {
        return {
            name: "Assert",
            type: "Decorator",
            children: 1,
            status: ["success"],
            desc: "断言",
            args: [
                {
                    name: "message",
                    desc: "消息",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING,
                },
            ],
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 当子节点返回 \`failure\` 时，抛出异常
                + 其余情况返回子节点的执行状态
            `,
        };
    }
}
