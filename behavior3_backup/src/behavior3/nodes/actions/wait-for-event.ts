import { Blackboard } from "../../blackboard";
import type { Context } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree, TreeEvent } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

export class WaitForEvent extends Node {
    declare args: {
        readonly event: string;
    };

    private _triggerKey!: string;
    private _expiredKey!: string;

    constructor(context: Context, cfg: NodeData) {
        super(context, cfg);

        this._triggerKey = Blackboard.makeTempVar(this, "trigger");
        this._expiredKey = Blackboard.makeTempVar(this, "expired");
    }



    static override get descriptor(): NodeDef {
        return {
            name: "WaitForEvent",
            type: "Action",
            children: 0,
            status: ["success", "running"],
            desc: "等待事件触发",
            args: [
                {
                    name: "event",
                    desc: "事件名称",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING,
                },
            ],
        };
    }
}
