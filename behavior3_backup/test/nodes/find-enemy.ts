import { Node, NodeDef } from "../../src/behavior3/node";
import { ValueType, VarType } from "../../../misc/b3type";

export class FindEnemy extends Node {
    declare args: {
        w: number;
        h: number;
        count?: number;
    };

    static override get descriptor(): Readonly<NodeDef> {
        return {
            name: "FindEnemy",
            type: "Action",
            desc: "寻找敌人",
            output: ["敌人"],
            args: [
                { name: "w", type: VarType.CODE_VAR, value_type: ValueType.INT, desc: "宽度" },
                { name: "h", type: VarType.CODE_VAR, value_type: ValueType.INT, desc: "高度" },
                { name: "count", type: VarType.CODE_VAR, value_type: ValueType.INT_OPTIONAL, desc: "数量" },
            ],
        };
    }
}
