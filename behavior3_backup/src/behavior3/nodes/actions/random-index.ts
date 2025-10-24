import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";

export class RandomIndex extends Node {
    declare input: [unknown[]];



    static override get descriptor(): NodeDef {
        return {
            name: "RandomIndex",
            type: "Action",
            children: 0,
            status: ["success", "failure"],
            desc: "随机返回输入的其中一个!",
            input: ["输入目标"],
            output: ["随机目标", "索引?"],
            doc: `
                + 合法元素不包括 \`undefined\` 和 \`null\`
                + 在输入数组中，随机返回其中一个
                + 当输入数组为空时，或者没有合法元素，返回 \`failure\`
            `,
        };
    }
}
