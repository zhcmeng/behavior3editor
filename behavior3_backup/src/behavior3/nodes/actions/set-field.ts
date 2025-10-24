import type { Context, ObjectType } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class SetField extends Node {
    declare input: [ObjectType, string?, unknown?];
    declare args: {
        readonly field?: string;
        readonly value?: unknown;
    };



    static override get descriptor(): NodeDef {
        return {
            name: "SetField",
            type: "Action",
            children: 0,
            status: ["success", "failure"],
            desc: "设置对象字段值",
            input: ["输入对象", "字段(field)?", "值(value)?"],
            args: [
                {
                    name: "field",
                    desc: "字段(field)",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING_OPTIONAL,
                },
                {
                    name: "value",
                    desc: "值(value)",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.JSON_OPTIONAL,
                },
            ],
            doc: `
                + 对输入对象设置 \`field\` 和 \`value\`
                + 输入参数1必须为对象，否则返回 \`failure\`
                + 如果 \`field\` 不为 \`string\`, 也返回 \`failure\`
                + 如果 \`value\` 为 \`undefined\` 或 \`null\`, 则删除 \`field\` 的值
            `,
        };
    }
}
