import type { Context, TargetType } from "../../context";
import { Node, NodeData, NodeDef, Status } from "../../node";
import { Tree, TreeEvent } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

const builtinEventOptions = [
    { name: "行为树被中断", value: TreeEvent.INTERRUPTED },
    { name: "行为树开始执行前", value: TreeEvent.BEFORE_TICKED },
    { name: "行为树执行完成后", value: TreeEvent.AFTER_TICKED },
    { name: "行为树执行成功后", value: TreeEvent.TICKED_SUCCESS },
    { name: "行为树执行失败后", value: TreeEvent.TICKED_FAILURE },
    { name: "行为树被清理", value: TreeEvent.CLEANED },
];

export class Listen extends Node {
    declare args: { readonly event: string };
    declare input: [TargetType | TargetType[] | undefined];
    declare output: [
        target?: string,
        arg0?: string,
        arg1?: string
        // argN?:string
    ];

    protected _isBuiltinEvent(event: string): boolean {
        return !!builtinEventOptions.find((e) => e.value === event);
    }

    protected _processOutput(
        tree: Tree<Context, unknown>,
        eventTarget?: TargetType,
        ...eventArgs: unknown[]
    ) {
        const [eventTargetKey] = this.cfg.output;
        if (eventTargetKey) {
            tree.blackboard.set(eventTargetKey, eventTarget);
        }
        for (let i = 1; i < this.cfg.output.length; i++) {
            const key = this.cfg.output[i];
            if (key) {
                tree.blackboard.set(key, eventArgs[i - 1]);
            }
        }
    }

    static override get descriptor(): NodeDef {
        return {
            name: "Listen",
            type: "Decorator",
            children: 1,
            status: ["success"],
            desc: "侦听事件",
            input: ["目标对象?"],
            output: ["事件目标?", "事件参数..."],
            args: [
                {
                    name: "event",
                    desc: "事件",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING,
                    options: builtinEventOptions.slice(),
                },
            ],
            doc: `
                + 当事件触发时，执行第一个子节点，多个仅执行第一个
                + 如果子节点返回 \`running\`，会中断执行并清理执行栈`,
        };
    }
}
