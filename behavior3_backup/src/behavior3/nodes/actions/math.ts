import type { Context } from "../../context";
import { Node, NodeData, NodeDef } from "../../node";
import { ValueType, VarType } from "../../../../../misc/b3type";

enum Op {
    // 基础运算
    abs = 0,
    ceil = 1,
    floor = 2,
    round = 3,
    sign = 4,
    // 三角函数
    sin = 5,
    cos = 6,
    tan = 7,
    atan2 = 8,
    // 幂和对数
    pow = 9,
    sqrt = 10,
    log = 11,
    // 最值运算
    min = 12,
    max = 13,
    // 随机数
    random = 14,
    randInt = 15,
    randFloat = 16,
    // 其他运算
    sum = 17,
    average = 18,
    product = 19,
}

export class MathNode extends Node {
    private _op: Op;

    constructor(context: Context, cfg: NodeData) {
        super(context, cfg);
        this._op = Op[cfg.args.op as keyof typeof Op];
        if (this._op === undefined) {
            throw new Error(`unknown op: ${cfg.args.op}`);
        }
    }

    static override get descriptor(): NodeDef {
        return {
            name: "Math",
            type: "Action",
            desc: "执行数学运算",
            input: ["参数..."],
            output: ["结果"],
            status: ["success", "failure"],
            args: [
                {
                    name: "op",
                    desc: "数学运算类型",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING,
                    options: [
                        // 基础运算
                        { name: "绝对值", value: Op[Op.abs] },
                        { name: "向上取整", value: Op[Op.ceil] },
                        { name: "向下取整", value: Op[Op.floor] },
                        { name: "四舍五入", value: Op[Op.round] },
                        { name: "符号", value: Op[Op.sign] },
                        // 三角函数
                        { name: "正弦", value: Op[Op.sin] },
                        { name: "余弦", value: Op[Op.cos] },
                        { name: "正切", value: Op[Op.tan] },
                        { name: "反正切2", value: Op[Op.atan2] },
                        // 幂和对数
                        { name: "幂运算", value: Op[Op.pow] },
                        { name: "平方根", value: Op[Op.sqrt] },
                        { name: "自然对数", value: Op[Op.log] },
                        // 最值运算
                        { name: "最小值", value: Op[Op.min] },
                        { name: "最大值", value: Op[Op.max] },
                        // 随机数
                        { name: "随机数", value: Op[Op.random] },
                        { name: "随机整数", value: Op[Op.randInt] },
                        { name: "随机浮点数", value: Op[Op.randFloat] },
                        // 其他运算
                        { name: "求和", value: Op[Op.sum] },
                        { name: "平均值", value: Op[Op.average] },
                        { name: "乘积", value: Op[Op.product] },
                    ],
                },
                {
                    name: "value1",
                    desc: "参数1（优先使用）",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.FLOAT_OPTIONAL,
                },
                {
                    name: "value2",
                    desc: "参数2（优先使用）",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.FLOAT_OPTIONAL,
                },
            ],
        };
    }
}
