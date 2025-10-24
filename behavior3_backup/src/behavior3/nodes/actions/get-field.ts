import { Node, NodeDef } from "../../node";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class GetField extends Node {
    declare input: [{ [key: string]: unknown }, string | undefined];
    declare args: { readonly field?: string };

    static override get descriptor(): NodeDef {
        return {
            name: "GetField",
            type: "Action",
            children: 0,
            status: ["success", "failure"],
            desc: "获取对象的字段值",
            args: [
                {
                    name: "field",
                    desc: "字段(field)",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING_OPTIONAL,
                },
            ],
            input: ["对象", "字段(field)?"],
            output: ["字段值(value)"],
            doc: `
                + 合法元素不包括 \`undefined\` 和 \`null\`
                + 只有获取到合法元素时候才会返回 \`success\`，否则返回 \`failure\`
            `,
        };
    }
}
