import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class RetryUntilSuccess extends Node {
    declare args: { readonly count?: number };

    static override get descriptor(): NodeDef {
        return {
            name: "RetryUntilSuccess",
            type: "Decorator",
            children: 1,
            status: ["|success", "|failure", "|running"],
            desc: "一直尝试直到子节点返回成功",
            input: ["最大尝试次数?"],
            args: [
                {
                    name: "count",
                    desc: "最大尝试次数",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.INT_OPTIONAL,
                },
            ],
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 只有当子节点返回 \`success\` 时，才返回 \`success\`，其它情况返回 \`running\` 状态
                + 如果设定了尝试次数，超过指定次数则返回 \`failure\``,
        };
    }
}
