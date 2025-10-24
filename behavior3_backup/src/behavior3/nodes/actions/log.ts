import type { Context } from "../../context";
import { Node, NodeDef, Status } from "../../node";
import { Tree } from "../../tree";
import { ValueType, VarType } from "../../../../../misc/b3type";

enum LogLevel {
    INFO = "info",
    DEBUG = "debug",
    WARN = "warn",
    ERROR = "error",
}

export class Log extends Node {
    declare input: [unknown?];
    declare args: {
        readonly message: string;
        readonly level: LogLevel;
    };



    static override get descriptor(): NodeDef {
        return {
            name: "Log",
            type: "Action",
            children: 0,
            status: ["success"],
            desc: "打印日志",
            input: ["日志?"],
            args: [
                {
                    name: "message",
                    desc: "日志",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING,
                },
                {
                    name: "level",
                    desc: "日志级别",
                    type: VarType.CODE_VAR,
                    value_type: ValueType.STRING,
                    default: LogLevel.INFO,
                    options: [
                        {
                            name: "INFO",
                            value: LogLevel.INFO,
                        },
                        {
                            name: "DEBUG",
                            value: LogLevel.DEBUG,
                        },
                        {
                            name: "WARN",
                            value: LogLevel.WARN,
                        },
                        {
                            name: "ERROR",
                            value: LogLevel.ERROR,
                        },
                    ],
                },
            ],
        };
    }
}
