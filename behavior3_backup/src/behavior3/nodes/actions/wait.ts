import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class Wait extends Node {
    declare args: {
        readonly time: number;
        readonly random?: number;
    };



    static override get descriptor(): NodeDef {
        return {
            name: "Wait",
            type: "Action",
            children: 0,
            status: ["success", "running"],
            desc: "等待",
            input: ["等待时间?"],
            args: [
                {
                    name: "time",
                    desc: "等待时间",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.FLOAT_OPTIONAL,
                },
                {
                    name: "random",
                    desc: "随机范围",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.FLOAT_OPTIONAL,
                },
            ],
        };
    }
}
