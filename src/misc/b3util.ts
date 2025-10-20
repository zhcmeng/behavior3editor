/**
 * 文件：b3util.ts
 * 用途：行为树数据的校验、刷新、构建与变量收集等通用工具。
 * 描述：提供节点参数检查、子树解析、状态标记构建、批量构建脚本执行、变量导入去重与缓存等功能。
 * 作者：zhandouxiaojiji & codetypes
 * 创建日期：2025-10-16
 * 说明：本文件注释采用统一的 JSDoc 风格，函数均包含功能、参数与返回值说明；关键逻辑处辅以行内注释解释处理意图与边界条件。
 */
import assert from "assert";
import * as fs from "fs";
import { ExpressionEvaluator, NodeDef } from "../behavior3/src/behavior3";
import "./array";
import {
  FileVarDecl,
  hasArgOptions,
  ImportDecl,
  isBoolType,
  isExprType,
  isFloatType,
  isIntType,
  isJsonType,
  isStringType,
  keyWords,
  NodeArg,
  NodeData,
  TreeData,
  VarDecl,
  VERSION,
} from "./b3type";
import Path from "./path";
import { readJson, readTree, readWorkspace } from "./util";

/**
 * NodeDefs：节点定义表。
 *
 * 说明：对 Map 进行封装，保证通过 get 获取不存在的节点时返回占位的 unknown 定义，
 *       避免下游逻辑出现空值判断分支过多。
 */
export class NodeDefs extends Map<string, NodeDef> {
  get(key: string): NodeDef {
    return super.get(key) ?? unknownNodeDef;
  }
}

type Env = {
  fs: typeof fs;
  path: typeof Path;
  workdir: string;
  nodeDefs: NodeDefs;
};

/**
 * BatchScript：构建脚本接口。
 *
 * 用于在项目构建过程中注入自定义的批处理逻辑（树级、节点级、写文件与完成回调）。
 */
export interface BatchScript {
  onSetup?(env: Env): void;
  onProcessTree?(tree: TreeData, path: string, errors: string[]): TreeData | null;
  onProcessNode?(node: NodeData, errors: string[]): NodeData | null;
  onWriteFile?(path: string, tree: TreeData): void;
  onComplete?(status: "success" | "failure"): void;
}

export let calcSize: (d: NodeData) => number[] = () => [0, 0];
export let nodeDefs: NodeDefs = new NodeDefs();
export let groupDefs: string[] = [];
export let usingGroups: Record<string, boolean> | null = null;
export let usingVars: Record<string, VarDecl> | null = null;
export const files: Record<string, number> = {};

const parsedVarDecl: Record<string, ImportDecl> = {};
const parsedExprs: Record<string, string[]> = {};
let checkExpr: boolean = false;
let workdir: string = "";
let alertError: (msg: string, duration?: number) => void = () => {};

const unknownNodeDef: NodeDef = {
  name: "unknown",
  desc: "",
  type: "Action",
};

/**
 * 初始化工作目录与错误提示回调。
 * @param path 工作区根路径
 * @param handler 错误提示函数（包含消息与可选停留时长）
 * @returns void
 */
export const initWorkdir = (path: string, handler: typeof alertError) => {
  workdir = path;
  alertError = handler;
  const nodeDefData = readJson(`${workdir}/node-config.b3-setting`) as NodeDef[];
  const groups: Set<string> = new Set();
  nodeDefs = new NodeDefs();
  for (const v of nodeDefData) {
    nodeDefs.set(v.name, v);
    v.group?.forEach((g) => groups.add(g));
  }
  groupDefs = Array.from(groups).sort();
};

/**
 * 设置节点尺寸计算器。
 * @param calc 根据节点数据计算尺寸的回调，返回 `[width,height]`
 * @returns void
 */
export const setSizeCalculator = (calc: (d: NodeData) => number[]) => {
  calcSize = calc;
};

/**
 * 更新启用的节点分组集合。
 * @param group 启用的分组名称列表
 * @returns void
 */
export const updateUsingGroups = (group: string[]) => {
  usingGroups = null;
  for (const g of group) {
    usingGroups ??= {};
    usingGroups[g] = true;
  }
};

/**
 * 更新启用的变量集合。
 * @param vars 变量声明列表
 * @returns void
 */
export const updateUsingVars = (vars: VarDecl[]) => {
  usingVars = null;
  for (const v of vars) {
    usingVars ??= {};
    usingVars[v.name] = v;
  }
};

/**
 * 开启/关闭表达式语法检查。
 * @param check true 开启表达式 dry-run 检查；false 关闭
 * @returns void
 */
export const setCheckExpr = (check: boolean) => {
  checkExpr = check;
};

/**
 * 解析表达式中的变量引用（按词法粗略提取）。
 * @param expr 表达式字符串
 * @returns 提取到的变量名列表（去除属性访问的后缀）
 */
export const parseExpr = (expr: string) => {
  if (parsedExprs[expr]) {
    return parsedExprs[expr];
  }
  const result = expr
    .split(/[^a-zA-Z0-9_.]/)
    .map((v) => v.split(".")[0])
    .filter((v) => isValidVariableName(v));
  parsedExprs[expr] = result;
  return result;
};

/**
 * 深度优先遍历任意带 children 的树结构。
 * @param node 根节点
 * @param visitor 访问回调；返回 false 可提前终止该分支遍历
 * @param depth 起始深度，默认 0
 * @returns void
 */
export const dfs = <T extends { children?: T[] }>(
  node: T,
  visitor: (node: T, depth: number) => unknown,
  depth: number = 0
) => {
  const traverse = (n: T, d: number) => {
    if (visitor(n, d) === false) {
      return false;
    }
    if (n.children) {
      for (const child of n.children) {
        if (traverse(child, d + 1) === false) {
          return false;
        }
      }
    }
  };
  traverse(node, depth);
};

/**
 * 比较版本号是否新于当前版本。
 * @param version 目标版本号（SemVer 格式）
 * @returns 是否为更高版本
 */
export const isNewVersion = (version: string) => {
  const [major, minor, patch] = version.split(".").map(Number);
  const [major2, minor2, patch2] = VERSION.split(".").map(Number);
  return (
    major > major2 ||
    (major === major2 && minor > minor2) ||
    (major === major2 && minor === minor2 && patch > patch2)
  );
};

/**
 * 校验变量名是否合法（标识符规则 + 关键字过滤）。
 * @param name 变量名
 * @returns 是否合法
 */
export const isValidVariableName = (name: string) => {
  return /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(name) && !keyWords.includes(name);
};

/**
 * 判断节点是否为子树根（引用外部路径且非整树根 id=1）。
 * @param data 节点数据
 * @returns 是否为子树根
 */
export const isSubtreeRoot = (data: NodeData) => {
  return data.path && data.id !== "1";
};

/**
 * 判断两个节点在定义层面是否等价（忽略运行态属性）。
 * @param node1 节点1
 * @param node2 节点2
 * @returns 是否等价
 */
export const isNodeEqual = (node1: NodeData, node2: NodeData) => {
  if (
    node1.name === node2.name &&
    node1.desc === node2.desc &&
    node1.path === node2.path &&
    node1.debug === node2.debug &&
    node1.disabled === node2.disabled
  ) {
    const def = nodeDefs.get(node1.name);

    for (const arg of def.args ?? []) {
      if (node1.args?.[arg.name] !== node2.args?.[arg.name]) {
        return false;
      }
    }

    if (def.input?.length) {
      const len = Math.max(node1.input?.length ?? 0, node2.input?.length ?? 0);
      for (let i = 0; i < len; i++) {
        if (node1.input?.[i] !== node2.input?.[i]) {
          return false;
        }
      }
    }

    if (def.output?.length) {
      const len = Math.max(node1.output?.length ?? 0, node2.output?.length ?? 0);
      for (let i = 0; i < len; i++) {
        if (node1.output?.[i] !== node2.output?.[i]) {
          return false;
        }
      }
    }

    return true;
  }
  return false;
};

/**
 * 统一错误输出，用于校验阶段的错误消息。
 * @param data 当前节点
 * @param msg 错误描述
 */
const error = (data: NodeData, msg: string) => {
  console.error(`check ${data.id}|${data.name}: ${msg}`);
};

/**
 * 获取参数类型的基础类型（去除数组与可选修饰）。
 * @param arg 参数定义
 * @returns 原始类型字符串（如 "int"、"string"）
 */
export const getNodeArgRawType = (arg: NodeArg) => {
  return arg.type.match(/^\w+/)![0] as NodeArg["type"];
};

/**
 * 判断参数是否为数组类型。
 * @param arg 参数定义
 * @returns 是否为数组
 */
export const isNodeArgArray = (arg: NodeArg) => {
  return arg.type.includes("[]");
};

/**
 * 判断参数是否为可选类型。
 * @param arg 参数定义
 * @returns 是否可选
 */
export const isNodeArgOptional = (arg: NodeArg) => {
  return arg.type.includes("?");
};

/**
 * 校验单个参数的取值是否满足类型与可选规则。
 * @param data 当前节点（用于报错追踪）
 * @param arg 参数定义
 * @param value 参数值
 * @param verbose 是否输出详细错误日志
 * @returns 是否通过校验
 */
export const checkNodeArgValue = (
  data: NodeData,
  arg: NodeArg,
  value: unknown,
  verbose?: boolean
) => {
  let hasError = false;
  const type = getNodeArgRawType(arg);
  if (isFloatType(type)) {
    // 浮点：允许 number；未赋值且为可选通过
    const isNumber = typeof value === "number";
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(isNumber || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a number`);
      }
      hasError = true;
    }
  } else if (isIntType(type)) {
    // 整数：要求 number 且为整数；未赋值且为可选通过
    const isInt = typeof value === "number" && value === Math.floor(value);
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(isInt || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a int`);
      }
      hasError = true;
    }
  } else if (isStringType(type)) {
    // 字符串：允许非空字符串；可选情况下允许空字符串/未赋值
    const isString = typeof value === "string" && value;
    const isOptional = (value === undefined || value === "") && isNodeArgOptional(arg);
    if (!(isString || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a string`);
      }
      hasError = true;
    }
  } else if (isExprType(type)) {
    // 表达式：与字符串相同，但后续可能进行表达式 dry-run
    const isExpr = typeof value === "string" && value;
    const isOptional = (value === undefined || value === "") && isNodeArgOptional(arg);
    if (!(isExpr || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not an expr string`);
      }
      hasError = true;
    }
  } else if (isJsonType(type)) {
    // JSON/对象：非空判定；可选允许未赋值
    const isJson = value !== undefined && value !== "";
    const isOptional = isNodeArgOptional(arg);
    if (!(isJson || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${value}' is not an invalid object`);
      }
      hasError = true;
    }
  } else if (isBoolType(type)) {
    // 布尔：允许 boolean 或未赋值（布尔默认 false 情况常见）
    const isBool = typeof value === "boolean" || value === undefined;
    if (!isBool) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a boolean`);
      }
      hasError = true;
    }
  } else {
    hasError = true;
    error(data, `unknown arg type '${arg.type}'`);
  }

  if (hasArgOptions(arg)) {
    // 离散枚举：仅允许在 options 中声明的取值；可选允许未赋值
    const found = !!arg.options?.find((option) => option.value === value);
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(found || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a one of the option values`);
      }
      hasError = true;
    }
  }

  return !hasError;
};

/**
 * 校验节点的第 i 个参数（支持数组与 oneof 限制）。
 * @param data 节点数据
 * @param conf 节点定义
 * @param i 参数下标
 * @param verbose 是否输出详细错误日志
 * @returns 是否通过校验
 */
export const checkNodeArg = (data: NodeData, conf: NodeDef, i: number, verbose?: boolean) => {
  let hasError = false;
  const arg = conf.args![i] as NodeArg;
  const value = data.args?.[arg.name];
  if (isNodeArgArray(arg)) {
    // 数组参数：必须为非空数组（除非参数可选）
    if (!Array.isArray(value) || value.length === 0) {
      if (!isNodeArgOptional(arg)) {
        if (verbose) {
          error(data, `'${arg.name}=${JSON.stringify(value)}' is not an array or empty array`);
        }
        hasError = true;
      }
    } else {
      for (let j = 0; j < value.length; j++) {
        if (!checkNodeArgValue(data, arg, value[j], verbose)) {
          hasError = true;
        }
      }
    }
  } else if (!checkNodeArgValue(data, arg, value, verbose)) {
    hasError = true;
  }
  if (arg.oneof !== undefined) {
    // oneof 语义：与某个 input 位置互斥（两者只允许其一）
    const idx = conf.input?.findIndex((v) => v.startsWith(arg.oneof!)) ?? -1;
    if (!checkOneof(arg, data.args?.[arg.name], data.input?.[idx])) {
      if (verbose) {
        error(
          data,
          `only one is allowed for between argument '${arg.name}' and input '${data.input?.[idx]}'`
        );
      }
      hasError = true;
    }
  }

  return !hasError;
};

/**
 * oneof 互斥检查：参数值与输入值只能二选一。
 * @param arg 参数定义（可能为数组）
 * @param argValue 参数值
 * @param inputValue 输入变量值
 * @returns 是否满足互斥
 */
export const checkOneof = (arg: NodeArg, argValue: unknown, inputValue: unknown) => {
  if (isNodeArgArray(arg)) {
    if (argValue instanceof Array && argValue.length === 0) {
      argValue = undefined;
    }
  }
  argValue = argValue === undefined ? "" : argValue;
  inputValue = inputValue ?? "";
  return (argValue !== "" && inputValue === "") || (argValue === "" && inputValue !== "");
};

/**
 * 综合校验节点数据是否满足定义（children/args/input/output/分组/变量/表达式）。
 * @param data 待校验的节点数据
 * @returns 是否通过所有检查
 */
export const checkNodeData = (data: NodeData | null | undefined) => {
  if (!data) {
    return false;
  }
  const conf = nodeDefs.get(data.name);
  if (conf.name === unknownNodeDef.name) {
    error(data, `undefined node: ${data.name}`);
    return false;
  }

  let hasError = false;

  if (conf.group) {
    // 节点分组必须启用（由 workspace 设置控制）
    if (!conf.group.some((g) => usingGroups?.[g])) {
      error(data, `node group '${conf.group}' is not enabled`);
      hasError = true;
    }
  }

  if (usingVars) {
    // 输入/输出变量必须在当前工作区变量集合中声明
    if (data.input) {
      for (const v of data.input) {
        if (v && !usingVars[v]) {
          error(data, `input variable '${v}' is not defined`);
          hasError = true;
        }
      }
    }
    if (data.output) {
      for (const v of data.output) {
        if (v && !usingVars[v]) {
          error(data, `output variable '${v}' is not defined`);
          hasError = true;
        }
      }
    }
  }

  if (data.args && conf.args) {
    for (const arg of conf.args) {
      const value = data.args?.[arg.name] as string | string[] | undefined;
      if (isExprType(arg.type) && value) {
        // 表达式参数：校验使用的变量是否存在、以及可选的 dry-run 语法检查
        if (usingVars) {
          const vars: string[] = [];
          if (typeof value === "string") {
            vars.push(...parseExpr(value));
          } else if (Array.isArray(value)) {
            for (const v of value) {
              vars.push(...parseExpr(v));
            }
          }
          for (const v of vars) {
            if (v && !usingVars[v]) {
              error(data, `expr variable '${arg.name}' is not defined`);
              hasError = true;
            }
          }
        }
        if (checkExpr) {
          const exprs: string[] = [];
          if (typeof value === "string") {
            exprs.push(value);
          } else if (Array.isArray(value)) {
            for (const v of value) {
              exprs.push(v);
            }
          }
          for (const expr of exprs) {
            try {
              // dryRun：仅执行解析与基本运算合法性，不做真实求值
              if (!new ExpressionEvaluator(expr).dryRun()) {
                error(data, `expr '${expr}' is not valid`);
                hasError = true;
              }
            } catch (e) {
              error(data, `expr '${expr}' is not valid`);
              hasError = true;
            }
          }
        }
      }
    }
  }

  if (conf.children !== undefined && conf.children !== -1) {
    // 固定子节点数量：需与定义一致
    const count = data.children?.length || 0;
    if (conf.children !== count) {
      hasError = true;
      error(data, `expect ${conf.children} children, but got ${count}`);
    }
  }

  let hasVaridicInput = false;
  if (conf.input) {
    for (let i = 0; i < conf.input.length; i++) {
      if (!data.input) {
        data.input = [];
      }
      if (!data.input[i]) {
        data.input[i] = "";
      }
      if (data.input[i] && !isValidVariableName(data.input[i])) {
        error(
          data,
          `input field '${data.input[i]}' is not a valid variable name,` +
            `should start with a letter or underscore`
        );
        hasError = true;
      }
      if (!isValidInputOrOutput(conf.input, data.input, i)) {
        error(data, `intput field '${conf.input[i]}' is required`);
        hasError = true;
      }
      if (i === conf.input.length - 1 && conf.input.at(-1)?.endsWith("...")) {
        // 末项为可变参数：允许输入扩展
        hasVaridicInput = true;
      }
    }
  }
  if (data.input && !hasVaridicInput) {
    // 非变参：截断为定义长度
    data.input.length = conf.input?.length || 0;
  }

  let hasVaridicOutput = false;
  if (conf.output) {
    for (let i = 0; i < conf.output.length; i++) {
      if (!data.output) {
        data.output = [];
      }
      if (!data.output[i]) {
        data.output[i] = "";
      }
      if (data.output[i] && !isValidVariableName(data.output[i])) {
        error(
          data,
          `output field '${data.output[i]}' is not a valid variable name,` +
            `should start with a letter or underscore`
        );
        hasError = true;
      }
      if (!isValidInputOrOutput(conf.output, data.output, i)) {
        error(data, `output field '${conf.output[i]}' is required`);
        hasError = true;
      }
      if (i === conf.output.length - 1 && conf.output.at(-1)?.endsWith("...")) {
        // 末项为可变参数：允许输出扩展
        hasVaridicOutput = true;
      }
    }
  }
  if (data.output && !hasVaridicOutput) {
    // 非变参：截断为定义长度
    data.output.length = conf.output?.length || 0;
  }
  if (conf.args) {
    const args: { [k: string]: unknown } = {};
    for (let i = 0; i < conf.args.length; i++) {
      const key = conf.args[i].name;
      if (data.args && data.args[key] === undefined && conf.args[i].default !== undefined) {
        // 赋默认值（保持序列化结果稳定）
        data.args[key] = conf.args[i].default;
      }

      const value = data.args?.[key];
      if (value !== undefined) {
        args[key] = value;
      }

      if (!checkNodeArg(data, conf, i, true)) {
        hasError = true;
      }
    }
    data.args = args;
  }

  if (data.children) {
    for (const child of data.children) {
      if (!checkNodeData(child)) {
        hasError = true;
      }
    }
  } else {
    // 统一 children 为空数组，避免后续遍历判断分支
    data.children = [];
  }

  return !hasError;
};

const parsingStack: string[] = [];

/**
 * 创建节点的浅拷贝（可选择递归拷贝子节点）。
 * @param data 源节点
 * @param includeChildren 是否包含子节点（遇到子树根时默认不展开）
 * @returns 新节点数据
 */
export const createNode = (data: NodeData, includeChildren: boolean = true) => {
  const node: NodeData = {
    id: data.id,
    name: data.name,
    desc: data.desc,
    path: data.path,
    debug: data.debug,
    disabled: data.disabled,
  };
  if (data.input) {
    node.input = [];
    for (const v of data.input) {
      node.input.push(v ?? "");
    }
  }
  if (data.output) {
    node.output = [];
    for (const v of data.output) {
      node.output.push(v ?? "");
    }
  }
  if (data.args) {
    node.args = {};
    for (const k in data.args) {
      const v = data.args[k];
      if (v !== undefined) {
        node.args[k] = v;
      }
    }
  }
  if (data.children && !isSubtreeRoot(data) && includeChildren) {
    node.children = [];
    for (const child of data.children) {
      node.children.push(createNode(child));
    }
  }
  return node;
};

const enum StatusFlag {
  SUCCESS = 2,
  FAILURE = 1,
  RUNNING = 0,
  SUCCESS_ZERO = 5,
  FAILURE_ZERO = 4,
}

/**
 * 将节点定义的状态集合映射为位标记。
 * @param data 节点数据
 * @returns 状态位标记（success/failure/running）
 */
const toStatusFlag = (data: NodeData) => {
  let status = 0;
  const def = nodeDefs.get(data.name);
  def.status?.forEach((s) => {
    switch (s) {
      case "success":
        status |= 1 << StatusFlag.SUCCESS;
        break;
      case "failure":
        status |= 1 << StatusFlag.FAILURE;
        break;
      case "running":
        status |= 1 << StatusFlag.RUNNING;
        break;
    }
  });
  return status;
};

/**
 * 聚合子节点状态位，附加“是否出现过成功/失败”标记。
 * @param status 当前聚合状态位
 * @param childStatus 子节点状态位
 * @returns 聚合后的状态位
 */
const appendStatusFlag = (status: number, childStatus: number) => {
  const childSuccess = (childStatus >> StatusFlag.SUCCESS) & 1;
  const childFailure = (childStatus >> StatusFlag.FAILURE) & 1;
  if (childSuccess === 0) {
    status |= 1 << StatusFlag.SUCCESS_ZERO;
  }
  if (childFailure === 0) {
    status |= 1 << StatusFlag.FAILURE_ZERO;
  }
  status |= childStatus;
  return status;
};

/**
 * 根据节点定义的组合规则构建最终状态位。
 *
 * 复杂算法说明：
 * - 基础：从自身 status 位开始，根据 def.status 组合子节点位含义。
 * - 取反（!success/!failure）：将子失败标记放入成功位，或反之；用于否定逻辑。
 * - 管道（|success/|failure/|running）：只要子节点有该位则置位；用于“或”聚合。
 * - 逻辑与（&success/&failure）：所有子节点必须满足，若存在子节点“从未出现过该位”（Zero 位标记），则清除此位。
 * - 若无组合规则，直接并入子状态位。
 * @param data 当前节点
 * @param childStatus 所有子节点聚合后的状态位
 * @returns void（原地更新 data.status）
 */
const buildStatusFlag = (data: NodeData, childStatus: number) => {
  let status = data.status!;
  const def = nodeDefs.get(data.name);
  if (def.status?.length) {
    const childSuccess = (childStatus >> StatusFlag.SUCCESS) & 1;
    const childFailure = (childStatus >> StatusFlag.FAILURE) & 1;
    const childRunning = (childStatus >> StatusFlag.RUNNING) & 1;
    const childHasZeroSuccess = (childStatus >> StatusFlag.SUCCESS_ZERO) & 1;
    const childHasZeroFailure = (childStatus >> StatusFlag.FAILURE_ZERO) & 1;
    def.status?.forEach((s) => {
      switch (s) {
        case "!success":
          status |= childFailure << StatusFlag.SUCCESS;
          break;
        case "!failure":
          status |= childSuccess << StatusFlag.FAILURE;
          break;
        case "|success":
          status |= childSuccess << StatusFlag.SUCCESS;
          break;
        case "|failure":
          status |= childFailure << StatusFlag.FAILURE;
          break;
        case "|running":
          status |= childRunning << StatusFlag.RUNNING;
          break;
        case "&success":
          if (childHasZeroSuccess) {
            status &= ~(1 << StatusFlag.SUCCESS);
          } else {
            status |= childSuccess << StatusFlag.SUCCESS;
          }
          break;
        case "&failure":
          if (childHasZeroFailure) {
            status &= ~(1 << StatusFlag.FAILURE);
          } else {
            status |= childFailure << StatusFlag.FAILURE;
          }
          break;
      }
    });
    data.status = status;
  } else {
    data.status = status | childStatus;
  }
};

/**
 * 检查节点子节点数量是否满足定义。
 * @param data 节点数据
 * @returns 是否有效
 */
export const isValidChildren = (data: NodeData) => {
  const def = nodeDefs.get(data.name);
  if (def.children !== undefined && def.children !== -1) {
    return (data.children?.length || 0) === def.children;
  }
  return true;
};

/**
 * 判断某输入/输出定义是否为可变参数（尾项以 ... 结尾）。
 * @param def 定义列表
 * @param i 位置索引，-1 表示尾项
 * @returns 是否为可变参数
 */
export const isVariadic = (def: string[], i: number) => {
  if (i === -1) {
    i = def.length - 1;
  }
  return def[i].endsWith("...") && i === def.length - 1;
};

/**
 * 校验输入/输出在指定位置是否满足：必填或已有值或处于变参。
 * @param def 定义列表
 * @param data 实际数据
 * @param index 位置索引
 * @returns 是否有效
 */
const isValidInputOrOutput = (def: string[], data: string[] | undefined, index: number) => {
  return def[index].includes("?") || data?.[index] || isVariadic(def, index);
};

/**
 * 快速校验：仅检查输入/输出/子节点与参数基本合法性。
 * @param data 根节点数据
 * @returns 是否通过校验
 */
export const checkTreeData = (data: NodeData) => {
  const def = nodeDefs.get(data.name);
  if (def.input) {
    for (let i = 0; i < def.input.length; i++) {
      if (!isValidInputOrOutput(def.input, data.input, i)) {
        return false;
      }
    }
  }
  if (def.output) {
    for (let i = 0; i < def.output.length; i++) {
      if (!isValidInputOrOutput(def.output, data.output, i)) {
        return false;
      }
    }
  }
  if (!isValidChildren(data)) {
    return false;
  }
  if (def.args) {
    for (let i = 0; i < def.args.length; i++) {
      if (!checkNodeArg(data, def, i, false)) {
        return false;
      }
    }
  }

  return true;
};

/**
 * 刷新节点数据：重新编号、计算尺寸、解析子树并构建状态位。
 * @param node 待刷新的节点（原地更新）
 * @param id 起始编号（会自增）
 * @returns 返回下一个可用编号
 */
export const refreshNodeData = (node: NodeData, id: number) => {
  node.id = (id++).toString();
  node.size = calcSize(node);

  const def = nodeDefs.get(node.name);

  if (def.args) {
    node.args ||= {};
    def.args.forEach((arg) => {
      assert(node.args);
      if (node.args[arg.name] === undefined && arg.default !== undefined) {
        node.args[arg.name] = arg.default;
      }
    });
  }

  if (node.path) {
    // 子树解析：使用 parsingStack 防止循环引用，解析后将子树数据“内联”到当前节点
    if (parsingStack.indexOf(node.path) >= 0) {
      alertError(`循环引用节点：${node.path}`, 4);
      return id;
    }
    parsingStack.push(node.path);
    try {
      const subtreePath = workdir + "/" + node.path;
      const subtree = readTree(subtreePath).root;
      id = refreshNodeData(subtree, --id);
      node.name = subtree.name;
      node.desc = subtree.desc;
      node.args = subtree.args;
      node.input = subtree.input;
      node.output = subtree.output;
      node.children = subtree.children;
      node.mtime = fs.statSync(subtreePath).mtimeMs;
      node.size = calcSize(node);
    } catch (e) {
      alertError(`解析子树失败：${node.path}`);
      console.log("parse subtree:", e);
    }
    parsingStack.pop();
  } else if (node.children?.length) {
    for (let i = 0; i < node.children.length; i++) {
      id = refreshNodeData(node.children[i], id);
    }
  }

  node.status = toStatusFlag(node);
  if (node.children) {
    // 聚合子节点状态位并按定义组合到当前节点
    let childStatus = 0;
    node.children.forEach((child) => {
      if (child.status && !child.disabled) {
        childStatus = appendStatusFlag(childStatus, child.status);
      }
    });
    buildStatusFlag(node, childStatus);
  }

  return id;
};

/**
 * 构建树数据：读取文件、刷新节点、重写 id 前缀并序列化。
 * @param path 树文件绝对路径
 * @returns 构建好的树模型或 null
 */
export const createBuildData = (path: string) => {
  try {
    const treeModel: TreeData = readTree(path);
    refreshNodeData(treeModel.root, 1);
    // 为导出数据加上 prefix（通常用于区分不同文件的节点编号命名空间）
    dfs(treeModel.root, (node) => (node.id = treeModel.prefix + node.id));
    treeModel.name = Path.basenameWithoutExt(path);
    treeModel.root = createFileData(treeModel.root, true);
    return treeModel as TreeData;
  } catch (e) {
    console.log("build error:", path, e);
  }
  return null;
};

/**
 * 执行批处理脚本：树级与节点级的处理，并收集错误信息。
 * @param tree 原始树模型
 * @param path 源文件路径
 * @param batch 构建脚本实例
 * @param errors 错误消息输出数组
 * @returns 处理后的树模型或 null
 */
export const processBatch = (
  tree: TreeData | null,
  path: string,
  batch: BatchScript,
  errors: string[]
) => {
  if (!tree) {
    return null;
  }
  if (batch.onProcessTree) {
    tree = batch.onProcessTree(tree, path, errors);
  }
  if (!tree) {
    return null;
  }
  if (batch.onProcessNode) {
    // 深度优先处理所有节点，允许 onProcessNode 返回 null 表示删除该节点
    const processNode = (node: NodeData) => {
      if (node.children) {
        const children: NodeData[] = [];
        node.children?.forEach((child) => {
          const newChild = processNode(child);
          if (newChild) {
            children.push(newChild);
          }
        });
        node.children = children;
      }
      return batch.onProcessNode?.(node, errors);
    };
    tree.root = processNode(tree.root) ?? ({} as NodeData);
  }
  return tree;
};

/**
 * 构建整个项目：遍历工作区 json 文件、应用构建脚本、刷新变量声明并写入目标目录。
 * @param project 工作区文件路径（workspace.b3-workspace）
 * @param buildDir 构建输出根目录
 * @returns 是否存在错误（true 表示构建过程中有错误发生）
 */
export const buildProject = async (project: string, buildDir: string) => {
  let hasError = false;
  const settings = readWorkspace(project).settings;
  let buildScript: BatchScript | undefined;
  if (settings.checkExpr) {
    setCheckExpr(true);
  }
  if (settings.buildScript) {
    const scriptPath = workdir + "/" + settings.buildScript;
    try {
      buildScript = await loadModule(scriptPath);
    } catch (e) {
      console.error(`'${scriptPath}' is not a valid build script`);
    }
  }
  if (buildScript) {
    buildScript.onSetup?.({
      fs,
      path: Path,
      workdir,
      nodeDefs,
    });
  }

  for (const path of Path.ls(Path.dirname(project), true)) {
    if (path.endsWith(".json")) {
      const buildpath = buildDir + "/" + path.substring(workdir.length + 1);
      let tree = createBuildData(path);
      const errors: string[] = [];
      if (buildScript) {
        tree = processBatch(tree, path, buildScript, errors);
      }
      if (!tree) {
        continue;
      }
      if (tree.export === false) {
        console.log("skip:", buildpath);
        continue;
      }
      console.log("build:", buildpath);
      if (errors.length) {
        errors.forEach((msg) => console.error(msg));
        hasError = true;
      }
      const declare: FileVarDecl = {
        import: tree.import.map((v) => ({ path: v, vars: [], depends: [] })),
        vars: tree.vars.map((v) => ({ name: v.name, desc: v.desc })),
        subtree: [],
      };
      // 刷新变量声明：导入文件与子树内的变量统一收集，重建 usingGroups/usingVars
      refreshVarDecl(tree.root, tree.group, declare);
      if (!checkNodeData(tree?.root)) {
        hasError = true;
      }
      // 可选回调：允许脚本在写文件前做额外处理（如生成索引、统计信息等）
      buildScript?.onWriteFile?.(buildpath, tree);
      fs.mkdirSync(Path.dirname(buildpath), { recursive: true });
      fs.writeFileSync(buildpath, JSON.stringify(tree, null, 2));
    }
  }
  buildScript?.onComplete?.(hasError ? "failure" : "success");
  return hasError;
};

/**
 * 动态加载构建脚本：Renderer 环境使用 import；Main 环境复制为 mjs 临时加载。
 * @param path 脚本绝对路径
 * @returns 加载的模块对象或 null
 */
export const loadModule = async (path: string) => {
  try {
    if (typeof require !== "undefined" && require.cache) {
      delete require.cache[require.resolve(path)];
    }
    if (process.type === "renderer") {
      return await import(/* @vite-ignore */ `${path}?t=${Date.now()}`);
    } else {
      const mjs = path.endsWith(".mjs") ? path : path.replace(".js", ".mjs");
      fs.copyFileSync(path, mjs);
      const ret = await import(/* @vite-ignore */ `file:///${mjs}?t=${Date.now()}`);
      fs.unlinkSync(mjs);
      return ret;
    }
  } catch (e) {
    console.error(`failed to load module: ${path}`, e);
    return null;
  }
};

/**
 * 生成文件序列化友好的节点数据（剔除空字段并保持子树展开策略）。
 * @param data 源节点
 * @param includeSubtree 是否保留子树引用节点的 children 内容
 * @returns 文件写入用的节点对象
 */
export const createFileData = (data: NodeData, includeSubtree?: boolean) => {
  const nodeData: NodeData = {
    id: data.id,
    name: data.name,
    desc: data.desc || undefined,
    args: data.args || undefined,
    input: data.input || undefined,
    output: data.output || undefined,
    debug: data.debug || undefined,
    disabled: data.disabled || undefined,
    path: data.path || undefined,
  };
  const conf = nodeDefs.get(data.name);
  if (!conf.input?.length) {
    nodeData.input = undefined;
  }
  if (!conf.output?.length) {
    nodeData.output = undefined;
  }
  if (!conf.args?.length) {
    nodeData.args = undefined;
  }

  if (data.children?.length && (includeSubtree || !isSubtreeRoot(data))) {
    nodeData.children = [];
    data.children.forEach((child) => {
      nodeData.children!.push(createFileData(child, includeSubtree));
    });
  }
  return nodeData;
};

/**
 * 创建一个最小行为树模板。
 * @param path 目标文件路径（用于设置树名）
 * @returns 新建的树模型
 */
export const createNewTree = (path: string) => {
  const tree: TreeData = {
    version: VERSION,
    name: Path.basenameWithoutExt(path),
    prefix: "",
    group: [],
    import: [],
    vars: [],
    root: {
      id: "1",
      name: "Sequence",
    },
  };
  return tree;
};

/**
 * 判断路径是否为行为树文件（.json）。
 * @param path 文件路径
 * @returns 是否为树文件
 */
export const isTreeFile = (path: string) => {
  return path.toLocaleLowerCase().endsWith(".json");
};

/**
 * 加载并合并一组 ImportDecl 对应的变量声明（含缓存与依赖跟踪）。
 * @param list 导入条目列表（将被就地更新）
 * @param arr 输出变量数组（追加）
 * @returns void
 */
const loadVarDecl = (list: ImportDecl[], arr: Array<VarDecl>) => {
  for (const entry of list) {
    if (!files[entry.path]) {
      console.warn(`file not found: ${workdir}/${entry.path}`);
      continue;
    }

    let changed = false;
    if (!entry.modified || files[entry.path] > entry.modified) {
      changed = true;
    }

    if (!changed) {
      changed = entry.depends.some((v) => files[v.path] && files[v.path] > v.modified);
    }

    if (!changed) {
      continue;
    }

    entry.vars = [];
    entry.depends = [];
    entry.modified = files[entry.path];

    const vars: Set<VarDecl> = new Set();
    const depends: Set<string> = new Set();
    const load = (path: string) => {
      if (parsingStack.includes(path)) {
        return;
      }

      const parsedEntry: ImportDecl | undefined = parsedVarDecl[path];
      if (parsedEntry && files[path] === parsedEntry.modified) {
        parsedEntry.depends.forEach((v) => depends.add(v.path));
        parsedEntry.vars.forEach((v) => vars.add(v));
        return;
      }

      parsingStack.push(path);
      try {
        const model: TreeData = readTree(`${workdir}/${path}`);
        model.vars.forEach((v) => vars.add(v));
        model.import.forEach((v) => {
          load(v);
          depends.add(v);
        });
        console.debug(`load var: ${path}`);
      } catch (e) {
        alertError(`parsing error: ${path}`);
      }
      parsingStack.pop();
    };
    load(entry.path);
    entry.vars = Array.from(vars).sort((a, b) => a.name.localeCompare(b.name));
    entry.depends = Array.from(depends).map((v) => ({ path: v, modified: files[v] }));
    parsedVarDecl[entry.path] = {
      path: entry.path,
      vars: entry.vars.map((v) => ({ name: v.name, desc: v.desc })),
      depends: entry.depends.slice(),
      modified: entry.modified,
    };
  }
  list.forEach((entry) => arr.push(...entry.vars));
};

/**
 * 收集整棵树中所有子树引用路径。
 * @param data 根节点
 * @returns 子树路径列表
 */
const collectSubtree = (data: NodeData) => {
  const list: string[] = [];
  dfs(data, (node) => {
    if (node.path) {
      list.push(node.path);
    }
  });
  return list;
};

/**
 * 刷新变量声明缓存：根据导入与子树，重建 usingGroups 与 usingVars。
 * @param root 根节点
 * @param group 启用分组列表
 * @param declare 文件内变量声明（导入/子树/自身变量）
 * @returns 是否发生变化（用于触发 UI 或下游检查）
 */
export const refreshVarDecl = (root: NodeData, group: string[], declare: FileVarDecl) => {
  const filter: Record<string, boolean> = {};
  const vars: Array<VarDecl> = new (class extends Array {
    push(...items: VarDecl[]): number {
      for (const v of items) {
        if (filter[v.name]) {
          continue;
        }
        filter[v.name] = true;
        super.push(v);
      }
      return this.length;
    }
  })();
  vars.push(...declare.vars);
  parsingStack.length = 0;
  declare.subtree = collectSubtree(root).map((v) => ({
    path: v,
    vars: [],
    depends: [],
  }));
  loadVarDecl(declare.import, vars);
  loadVarDecl(declare.subtree, vars);

  let changed = false;
  const lastGroup = Array.from(Object.keys(usingGroups ?? {})).sort();
  group.sort();
  if (lastGroup.length !== group.length || lastGroup.some((v, i) => v !== group[i])) {
    changed = true;
    console.debug("refresh group:", lastGroup, group);
    updateUsingGroups(group);
  }

  const lastVars = Array.from(Object.keys(usingVars ?? {})).sort();
  vars.sort((a, b) => a.name.localeCompare(b.name));
  if (lastVars.length !== vars.length || lastVars.some((v, i) => v !== vars[i].name)) {
    changed = true;
    console.debug("refresh vars:", lastVars, vars);
    updateUsingVars(vars);
  }
  return changed;
};
