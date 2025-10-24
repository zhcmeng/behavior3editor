import type { Context } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Delay extends Node {
    declare args: {
        readonly delay: number;
        readonly cacheVars?: Readonly<string[]>;
    };

    static override get descriptor(): NodeDef {
        return {
            name: "Delay",
            type: "Decorator",
            children: 1,
            status: ["success"],
            desc: "延时执行子节点",
            input: ["延时时间?"],
            args: [
                {
                    name: "delay",
                    desc: "延时时间",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.FLOAT_OPTIONAL,
                },
                {
                    name: "cacheVars",
                    desc: "暂存环境变量",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING_ARRAY_OPTIONAL,
                },
            ],
            doc: `
                + 当延时触发时，执行第一个子节点，多个仅执行第一个
                + 如果子节点返回 \`running\`，会中断执行并清理执行栈`,
        };
    }
}
