import { Node, NodeDef } from "../../node";

export class Now extends Node {
    static override get descriptor(): NodeDef {
        return {
            name: "Now",
            type: "Action",
            children: 0,
            status: ["success"],
            desc: "获取当前时间",
            output: ["当前时间"],
        };
    }
}
