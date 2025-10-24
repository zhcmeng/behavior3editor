import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";

export class Filter extends Node {
    declare input: [unknown[]];

    static override get descriptor(): NodeDef {
        return {
            name: "Filter",
            type: "Decorator",
            children: 1,
            status: ["success", "failure", "|running"],
            desc: "返回满足条件的元素",
            input: ["输入数组"],
            output: ["变量", "新数组"],
            doc: `
                + 只能有一个子节点，多个仅执行第一个
                + 遍历输入数组，将当前元素写入\`变量\`，满足条件的元素放入新数组
                + 只有当新数组不为空时，才返回 \`success\`
            `,
        };
    }
}
