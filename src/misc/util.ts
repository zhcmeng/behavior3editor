import * as fs from "fs";
import { type WorkspaceModel } from "../contexts/workspace-context";
import { ArgType, ValueType, VarDecl, VERSION, type TreeData } from "./b3type";
import { dfs } from "./b3util";
import Path from "./path";

export const readJson = <T>(path: string): T => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str);
};

export const writeJson = <T>(path: string, data: T) => {
  const str = JSON.stringify(data, undefined, 2);
  fs.writeFileSync(path, str, "utf-8");
};

export const readWorkspace = (path: string) => {
  const data = readJson(path) as WorkspaceModel;
  data.settings = data.settings ?? {};
  return data;
};

export const readTree = (path: string) => {
  const data = readJson(path) as TreeData & { declvar?: VarDecl[] };
  data.version = data.version ?? VERSION;
  data.prefix = data.prefix ?? "";
  data.group = data.group || [];
  data.import = data.import || [];
  data.vars = data.vars || data.declvar || [];
  data.root = data.root || {};

  // 兼容旧版本：为变量添加默认类型
  data.vars = data.vars.map(v => ({
    name: v.name,
    desc: v.desc,
    type: v.type || ArgType.OBJECT_VAR,  // 默认为对象变量
    value_type: v.value_type || ValueType.STRING,
    value: v.value
  }));

  // compatible with old version
  dfs(data.root, (node) => (node.id = node.id.toString()));

  return data;
};

export const writeTree = (path: string, data: TreeData) => {
  writeJson<TreeData>(path, {
    version: VERSION,
    name: Path.basenameWithoutExt(path),
    desc: data.desc,
    prefix: data.prefix,
    export: data.export,
    group: data.group,
    import: data.import,
    vars: data.vars,
    root: data.root,
  });
};

/**
 * 合并多个类名，过滤掉空字符串和布尔值 false
 * @param cls 可以是字符串或布尔值的参数列表
 * @returns 合并后的类名字符串
 */
export function mergeClassNames(...cls: (string | boolean)[]): string {
  return cls.filter((v) => !!v).join(" ");
}
