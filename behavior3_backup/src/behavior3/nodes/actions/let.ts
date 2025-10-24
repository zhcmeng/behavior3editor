import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Let extends Node {
    declare args: { readonly value?: unknown };



    static override get descriptor(): NodeDef {
        return {
            name: "Let",
            type: "Action",
            children: 0,
            status: ["success"],
            desc: "定义新的变量名",
            input: ["已存在变量名?"],
            args: [
                {
                    name: "value",
                    desc: "值(value)",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.JSON_OPTIONAL,
                },
            ],
            output: ["新变量名"],
            doc: `
                + 如果有输入变量，则给已有变量重新定义一个名字
                + 如果\`值(value)\`为 \`null\`，则清除变量
            `,
        };
    }
}
