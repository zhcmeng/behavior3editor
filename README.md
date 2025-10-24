# 行为树编辑器

这是一个直观、可视化、通用的行为树编辑器，行为树的保存格式为 json，可以让策划自行去实现 AI，技能，buff 等复杂的游戏逻辑，从而减少不必要的沟通成本和提升开发效率。

![](readme/preview.gif)

## 示例项目

- 工作区: sample/workspace.b3-workspace
- 节点定义: sample/node-config.b3-setting
- 行为树目录: sample/workdir
- 批处理脚本: sample/scripts

## 节点定义

```typescript
export interface NodeDef {
    name: string;
    type: "Action" | "Decorator" | "Condition" | "Composite";
    desc: string;
    icon?: string;
    color?: string;
    input?: string[];
    output?: string[];
    args?: {
        name: string;
        type:
            | "boolean"
            | "boolean?"
            | "boolean[]"
            | "boolean[]?"
            | "int"
            | "int?"
            | "int[]"
            | "int[]?"
            | "float"
            | "float?"
            | "float[]"
            | "float[]?"
            | "string"
            | "string?"
            | "string[]"
            | "string[]?"
            | "json"
            | "json?"
            | "json[]"
            | "json[]?"
            | "expr"
            | "expr?"
            | "expr[]"
            | "expr[]?";
        desc: string;
        default?: unknown;
        /** Input `value`, only one is allowed between `value` and this arg.*/
    
        options?: { name: string; value: unknown }[];
    }[];
    status?:
      | "success"
      | "failure"
      | "running"
      | "!success"  !(child_success | child_success...)
      | "!failure"  !(child_failure | child_failure...)
      | "|success"  child_success | child_success...
      | "|failure"  child_failure | child_failure...
      | "|running"  child_running | child_running...
      | "&success"  child_success & child_success...
      | "&failure"; child_failure & child_failure...
    /** Allowed number of children
     * + -1: unlimited
     * + 0: no children
     * + 1: exactly one
     * + 3: exactly three child (ifelse)
     */
    children?: -1 | 0 | 1 | 3;
    doc?: string;  //文档说明(markdown格式)
}
```

节点定义配置在项目创建的时候会自动生成一个配置，参照[sample/node-config.b3-setting](sample/node-config.b3-setting)，这是个 json 的配置文件。编辑器不提供节点定义的编辑，强烈建议节点定义文件由代码生成 (参照示例项目[behavior3lua](https://github.com/zhandouxiaojiji/behavior3lua))。

## 编译与构建

```shell
npm install # 安装依赖
npm start # 运行测试
npm run build # 编译可执行文件
```

## 技术栈

- react + ts
- electron
- antd
- g6

## 安全性说明

⚠️ **重要提示**：本项目是为项目组内部使用设计的开发工具，为了开发便利性，禁用了部分 Electron 安全特性：

- `contextIsolation: false` - 渲染进程可直接访问 Node.js API
- `nodeIntegration: true` - 允许在渲染进程中使用 `require()`
- `webSecurity: false` - 禁用 Web 安全策略

**适用场景**：
- ✅ 团队内部使用
- ✅ 可信任的工作区和行为树文件
- ✅ 局域网或离线环境

**不适用场景**：
- ❌ 公开发布的应用
- ❌ 加载不可信的第三方内容
- ❌ 处理来自互联网的数据

如需在生产环境使用，建议启用 `contextIsolation: true` 并使用 `contextBridge` 安全地暴露 API。详见 [Electron 安全文档](https://www.electronjs.org/docs/latest/tutorial/security)。

## 示例行为树框架

- lua 版本 [behavior3lua](https://github.com/zhandouxiaojiji/behavior3lua)
- js/ts 版本 [behavior3-ts](https://github.com/zhongfq/behavior3-ts)。

## About

本项目将长期维护，欢迎各位大佬加群交流(Q 群:644761605)
