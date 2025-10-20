/**
 * 图形编辑器模块
 * 
 * 基于 AntV G6 图形库实现的行为树可视化编辑器
 * 
 * 核心功能：
 * 1. 行为树的可视化渲染（树形布局）
 * 2. 节点的交互操作（选择、拖拽、复制粘贴）
 * 3. 撤销/重做历史记录管理
 * 4. 节点搜索和高亮显示
 * 5. 子树的编辑和管理
 * 6. 拖拽排序和重组
 * 
 * 技术栈：
 * - AntV G6: 图形渲染引擎
 * - 自定义 TreeNode: 行为树节点渲染器
 * - Compact-box 布局: 紧凑的树形布局算法
 */
import {
    CanvasEvent as G6CanvasEvent,
    Graph as G6Graph,
    GraphOptions as G6GraphOptions,
    NodeData as G6NodeData,
    NodeEvent as G6NodeEvent,
    Rect as G6Rect,
    IPointerEvent as IG6PointerEvent,
    treeToGraphData,
} from "@antv/g6";
import { dialog } from "@electron/remote";
import assert from "assert";
import { clipboard } from "electron";
import * as fs from "fs";
import { ObjectType } from "../behavior3/src/behavior3";
import { EditNode, EditorStore, EditTree, useWorkspace } from "../contexts/workspace-context";
import { ImportDecl, isExprType, NodeData, TreeData, VarDecl } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import Path from "../misc/path";
import { readTree, writeTree } from "../misc/util";
import { TreeNodeState, TreeNodeStyle } from "./register-node";

/** G6 节点状态类型 */
type G6NodeState = Exclude<G6GraphOptions["node"], undefined>["state"];

/**
 * G6 内部接口类型
 * 
 * 用于访问 G6 的内部 context，清除悬停目标
 */
type IGraph = {
  context: {
    behavior?: {
      currentTarget: unknown;
    };
  };
};

/** 工作区全局实例 */
const workspace = useWorkspace.getState();

/**
 * 搜索过滤选项
 * 
 * 定义节点搜索和过滤的配置
 */
export interface FilterOption {
    /** 搜索结果节点 ID 列表 */
    results: string[];
    
    /** 当前结果索引 */
    index: number;
    
    /** 搜索字符串 */
    filterStr: string;
    
    /** 是否区分大小写 */
    filterCase: boolean;
    
    /** 是否只高亮匹配项（灰化其他） */
    filterFocus: boolean;
    
    /** 搜索类型：内容或 ID */
    filterType: "content" | "id";
    
    /** 占位符文本 */
    placeholder: string;
  }

/**
 * 图形编辑器类
 * 
 * 管理行为树的可视化编辑和交互
 * 
 * 架构设计：
 * - 使用 G6 作为底层渲染引擎
 * - 维护历史记录栈实现撤销/重做
 * - 事件驱动的交互模型
 * - 状态管理与 workspace 集成
 * 
 * 生命周期：
 * 1. 构造函数：初始化 G6 图形实例
 * 2. 绑定事件：监听用户交互
 * 3. 渲染：显示行为树
 * 4. 销毁：清理资源
 */
export class Graph {
  /** 数据变更回调（触发保存状态等） */
  onChange?: () => void;
  
  /** 搜索更新回调 */
  onUpdateSearch?: () => void;

  /** G6 图形实例 */
  private _graph: G6Graph;
  
  /** 历史记录栈（存储 JSON 字符串） */
  private _historyStack: string[] = [];
  
  /** 当前历史记录索引 */
  private _historyIndex: number = 0;
  
  /** 正在拖拽的节点 ID */
  private _dragId?: string;
  
  /** 拖拽目标节点 ID */
  private _dropId?: string;
  
  /** 当前选中的节点 ID */
  private _selectedId: string | null = null;

  /**
   * 构造函数
   * 
   * 初始化 G6 图形编辑器并配置所有交互行为
   * 
   * @param editor - 编辑器存储实例
   * @param ref - React 容器引用
   * 
   * 配置项：
   * - behaviors: 拖拽画布、缩放画布、悬停激活
   * - node: 使用自定义 TreeNode 渲染器
   * - edge: 横向三次贝塞尔曲线
   * - layout: compact-box 树形布局
   * 
   * 事件绑定：
   * - CLICK: 选择节点
   * - DBLCLICK: 编辑子树
   * - DRAG: 拖拽重组
   * - CONTEXT_MENU: 右键菜单
   */
  constructor(readonly editor: EditorStore, ref: React.RefObject<HTMLDivElement>) {
    this._graph = new G6Graph({
      // 容器元素
      container: ref.current!,
      
      // 交互行为
      behaviors: [
        "drag-canvas",      // 拖拽画布
        "zoom-canvas",      // 缩放画布
        "hover-activate",   // 悬停激活
      ],
      
      // 禁用动画（提高性能）
      animation: false,
      
      // 缩放范围 25%-200%
      zoomRange: [0.25, 2],
      
      // 节点配置
      node: {
        type: "TreeNode",  // 自定义节点类型
        style: {
          radius: 4,
          fill: "white",
          size: [260, 50],
          ports: [{ placement: "right" }, { placement: "left" }],
        },
        state: TreeNodeStyle as G6NodeState,  // 节点状态样式
      },
      
      // 边配置
      edge: {
        type: "cubic-horizontal",  // 横向三次贝塞尔曲线
        style: {
          lineWidth: 2,
          stroke: "#A3B1BF",
        },
        animation: {
          enter: false,  // 禁用进入动画
        },
      },
      
      // 布局配置
      layout: {
        type: "compact-box",  // 紧凑盒式布局
        direction: "LR",      // 从左到右
        
        // 按节点 ID 排序
        sortBy: (nodeA: G6NodeData, nodeB: G6NodeData) => {
          const dataA = nodeA.data as unknown as NodeData;
          const dataB = nodeB.data as unknown as NodeData;
          return Number(dataA.id) - Number(dataB.id);
        },
        
        // 获取节点高度
        getHeight: ({ data }: { data: NodeData }) => data.size![1],
        
        // 获取节点宽度
        getWidth: ({ data }: { data: NodeData }) => data.size![0],
        
        // 垂直间距
        getVGap: () => 10,
        
        // 水平间距
        getHGap: () => 30,
      },
    });
    
    // 绑定事件监听器
    this._graph.on(G6CanvasEvent.CLICK, this._onCanvasClick.bind(this));
    this._graph.on(G6NodeEvent.CONTEXT_MENU, this._onContextMenu.bind(this));
    this._graph.on(G6NodeEvent.CLICK, this._onClick.bind(this));
    this._graph.on(G6NodeEvent.DBLCLICK, this._onDblClick.bind(this));
    this._graph.on(G6NodeEvent.DRAG_START, this._onDragStart.bind(this));
    this._graph.on(G6NodeEvent.DRAG_END, this._onDragEnd.bind(this));
    this._graph.on(G6NodeEvent.DRAG_ENTER, this._onDragEnter.bind(this));
    this._graph.on(G6NodeEvent.DRAG_LEAVE, this._onDragLeave.bind(this));
    this._graph.on(G6NodeEvent.DRAG, this._onDrag.bind(this));
    this._graph.on(G6NodeEvent.DROP, this._onDrop.bind(this));
    
    // 初始化渲染
    this._update(editor.data);
    
    // 初始化历史记录
    this._historyIndex = -1;
    this._storeHistory(false);
  }

  /**
   * 销毁图形实例
   * 
   * 释放 G6 资源，取消事件监听
   * 
   * 调用时机：
   * - 组件卸载时
   * - 切换编辑器时
   */
  destroy() {
    this._graph.destroy();
  }

  /**
   * 获取当前行为树数据
   * 
   * @returns 行为树数据
   */
  get data() {
    return this.editor.data;
  }

  /**
   * 存储历史记录
   * 
   * 将当前状态保存到历史栈，支持撤销/重做
   * 
   * @param changed - 是否触发变更回调
   * 
   * 实现细节：
   * 1. 从图形中提取节点数据
   * 2. 序列化为 JSON 字符串
   * 3. 与栈顶比较，避免重复
   * 4. 清除当前索引之后的历史
   * 5. 推入新历史记录
   * 
   * 历史栈管理：
   * - 线性栈结构
   * - 新操作会清除"未来"的历史
   * - 触发 onChange 通知外部
   */
  private _storeHistory(changed: boolean = true) {
    // 如果已渲染，从图形提取最新数据
    if (this._graph.rendered) {
      this.editor.data.root = this._nodeToData("1");
    }
    
    // 序列化当前状态
    const str = JSON.stringify(this.data, null, 2);
    
    // 避免重复存储
    if (this._historyStack[this._historyIndex] !== str) {
      // 清除当前索引之后的历史（分支被废弃）
      this._historyStack.length = ++this._historyIndex;
      
      // 推入新历史
      this._historyStack.push(str);
      
      // 触发变更回调
      if (changed) {
        this.onChange?.();
      }
    }
  }

  /**
   * 应用历史记录
   * 
   * 从历史记录恢复状态（撤销/重做的核心）
   * 
   * @param str - 历史记录 JSON 字符串
   * 
   * 恢复流程：
   * 1. 清除节点选择
   * 2. 解析历史数据
   * 3. 更新变量声明
   * 4. 刷新图形显示
   * 5. 触发变更回调
   * 
   * 注意：
   * - 刷新 ID 和变量
   * - 清除检查器状态
   */
  private async _applyHistory(str: string) {
    // 清除节点检查器
    this.selectNode(null);
    
    // 解析历史数据
    const data = JSON.parse(str) as TreeData;
    
    // 恢复变量声明
    this.editor.declare.import = data.import.map((v) => ({ path: v, vars: [], depends: [] }));
    this.editor.declare.vars = data.vars.map((v) => ({ ...v }));
    
    // 更新图形（刷新 ID 和变量）
    await this._update(data, true, true);
    
    // 更新树检查器
    this.selectNode(null);
    this.onChange?.();
  }

  private async _update(data: TreeData, refreshId: boolean = true, refreshVars: boolean = false) {
    this.editor.data = data;
    if (refreshId) {
      b3util.refreshNodeData(this.data.root, 1);
    }

    if (refreshVars) {
      workspace.refresh(this.editor.path);
    }

    // clear current target avoid hover error
    const graph = this._graph as unknown as IGraph;
    if (graph.context.behavior) {
      graph.context.behavior.currentTarget = null;
    }

    this._graph.clear();
    this._graph.setData(
      treeToGraphData(data.root, {
        getNodeData: (node) => {
          return {
            id: node.id,
            prefix: this.data.prefix,
            data: node as unknown as Record<string, unknown>,
            children: node.children?.map((child) => child.id),
          };
        },
      })
    );
    await this._render();
  }

  setSize(width: number, height: number) {
    const [w, h] = this._graph.getSize();
    if (w !== width || h !== height) {
      this._graph.setSize(width, height);
    }
  }

  /**
   * 撤销操作
   * 
   * 回退到上一个历史状态
   * 
   * 实现：
   * - 检查是否有可撤销的历史
   * - 索引前移
   * - 应用历史记录
   * 
   * 快捷键：Ctrl+Z / Cmd+Z
   */
  async undo() {
    if (this._historyIndex > 0) {
      await this._applyHistory(this._historyStack[--this._historyIndex]);
    }
  }

  /**
   * 重做操作
   * 
   * 前进到下一个历史状态
   * 
   * 实现：
   * - 检查是否有可重做的历史
   * - 索引后移
   * - 应用历史记录
   * 
   * 快捷键：Ctrl+Y / Cmd+Shift+Z
   */
  async redo() {
    if (this._historyIndex < this._historyStack.length - 1) {
      await this._applyHistory(this._historyStack[++this._historyIndex]);
    }
  }

  private _nodeToData(id: string) {
    const node = this._graph.getElementData(id) as G6NodeData;
    const data = { ...node.data } as unknown as NodeData;
    if (node.children) {
      data.children = [];
      for (const child of node.children) {
        data.children.push(this._nodeToData(child));
      }
    } else {
      data.children = undefined;
    }
    return data;
  }

  private async _render() {
    if (!this._graph.rendered) {
      await this._graph.render();
    }
    const zoom = this._graph.getZoom();
    await this._graph.zoomTo(1, false);
    const [x, y] = this._graph.getPosition();
    await this._graph.translateTo([0, 0], false);
    await this._graph.render();
    await this._graph.translateTo([x, y], false);
    await this._graph.zoomTo(zoom, false);
  }

  private _getAncestors(id: string): G6NodeData[] {
    return this._graph.getAncestorsData(id, "tree") as G6NodeData[];
  }

  private _findSubtreeRoot(id: string): G6NodeData | null {
    const node = this._graph.getNodeData(id);
    const data = node.data as unknown as NodeData | undefined;
    if (data?.path) {
      return node;
    } else {
      return this._getAncestors(id).find((v) => (v.data as unknown as NodeData)?.path) ?? null;
    }
  }

  private _isSubtreeNode(id: string | null | undefined): boolean {
    return !!(id && this._findSubtreeRoot(id));
  }

  private _findParent(id: string) {
    return this._graph.getParentData(id, "tree") as G6NodeData | null;
  }

  private _findHightlight(
    node: NodeData,
    highlight: string[],
    changed?: [NodeData, TreeNodeState[]][]
  ) {
    changed ||= [];

    if (highlight.length > 0) {
      const states: TreeNodeState[] = [];

      for (const v of node.input ?? []) {
        if (highlight.includes(v)) {
          states.push("highlightinput");
          break;
        }
      }

      for (const v of node.output ?? []) {
        if (highlight.includes(v)) {
          states.push("highlightoutput");
          break;
        }
      }

      const def = b3util.nodeDefs.get(node.name);
      loop: for (const arg of def.args ?? []) {
        if (isExprType(arg.type)) {
          const expr = node.args?.[arg.name] as string | string[] | undefined;
          if (typeof expr === "string") {
            for (const v of b3util.parseExpr(expr)) {
              if (highlight.includes(v)) {
                states.push("highlightargs");
                break loop;
              }
            }
          } else if (expr instanceof Array) {
            for (const str of expr) {
              for (const v of b3util.parseExpr(str)) {
                if (highlight.includes(v)) {
                  states.push("highlightargs");
                  break loop;
                }
              }
            }
          }
        }
      }

      if (states.length > 0) {
        changed.push([node, states]);
      } else {
        changed.push([node, ["highlightgray"]]);
      }
    } else {
      changed.push([node, []]);
    }

    node.children?.forEach((child) => this._findHightlight(child, highlight, changed));

    return changed;
  }

  async expandElement() {
    for (const node of this._graph.getNodeData()) {
      await this._graph.expandElement(node.id, false);
    }
  }

  /**
   * 点击变量高亮
   * 
   * 高亮使用指定变量的所有节点
   * 
   * @param names - 变量名列表
   * 
   * 高亮规则：
   * - input 使用变量：高亮 input
   * - output 使用变量：高亮 output  
   * - args 表达式使用变量：高亮 args
   * - 不使用变量：灰化
   * 
   * 使用场景：
   * - 点击节点的 input/output 标签
   * - 点击变量列表中的变量
   * - 追踪变量的数据流
   * 
   * 状态管理：
   * - 移除旧的高亮状态
   * - 应用新的高亮状态
   * - 避免重复更新
   */
  clickVar(...names: string[]) {
    console.debug("click variable:", names);
    
    // 查找并计算高亮状态
    const nodes = this._findHightlight(this.data.root, names);
    
    for (const [node, states] of nodes) {
      const oldStates = this._getState(node.id).sort();
      const newStates = [...oldStates.filter((v) => !this._isHighlightState(v)), ...states].sort();
      
      // 只在状态改变时更新
      if (oldStates.length !== newStates.length || oldStates.some((v, i) => v !== newStates[i])) {
        this._setState(node.id, newStates);
      }
    }
    
    // 清除高亮时更新搜索
    if (names.length === 0) {
      this.onUpdateSearch?.();
    }
  }

  private _includeString(content: string | undefined, option: FilterOption) {
    if (!content || typeof content !== "string") {
      return false;
    } else if (option.filterCase) {
      return content.includes(option.filterStr);
    } else {
      return content.toLowerCase().includes(option.filterStr.toLowerCase());
    }
  }

  hightlightSearch(option: FilterOption, node: NodeData | null) {
    if (!node) {
      return;
    }

    let highlightGray = option.filterFocus && !!option.filterStr;

    if (option.filterStr) {
      const def = b3util.nodeDefs.get(node.name);
      let found = false;
      if (option.filterType === "id") {
        if (option.filterStr === node.id) {
          found = true;
        }
      } else {
        if (
          this._includeString(node.name, option) ||
          this._includeString(node.desc || def.desc, option)
        ) {
          found = true;
        }
        if (!found && node.input) {
          for (const str of node.input) {
            if (this._includeString(str, option)) {
              found = true;
              break;
            }
          }
        }
        if (!found && node.args) {
          loop: for (const str in node.args) {
            const value = node.args[str];
            if (typeof value === "string") {
              if (this._includeString(value, option)) {
                found = true;
                break loop;
              }
            } else if (value instanceof Array) {
              for (const v of value) {
                if (this._includeString(v, option)) {
                  found = true;
                  break loop;
                }
              }
            }
          }
        }
        if (!found && node.output) {
          for (const str of node.output) {
            if (this._includeString(str, option)) {
              found = true;
              break;
            }
          }
        }
        if (!found && node.path) {
          if (this._includeString(node.path, option)) {
            found = true;
          }
        }
      }
      if (found) {
        option.results.push(node.id);
        highlightGray = false;
      }
    }

    const states = this._getState(node.id).filter((v) => !this._isHighlightState(v));
    if (highlightGray) {
      states.push("highlightgray");
    }
    this._setState(node.id, states);

    node.children?.forEach((child) => this.hightlightSearch(option, child));
  }

  private _isTreeUpdated(editTree: EditTree) {
    if (
      this.data.prefix !== editTree.prefix ||
      this.data.export !== editTree.export ||
      this.data.name !== editTree.name ||
      this.data.desc !== editTree.desc
    ) {
      return true;
    }

    let max = Math.max(this.editor.declare.vars.length, editTree.vars.length);
    for (let i = 0; i < max; i++) {
      const v1: VarDecl | undefined = this.editor.declare.vars[i];
      const v2: VarDecl | undefined = editTree.vars[i];
      if (v1?.name !== v2?.name || v1?.desc !== v2?.desc) {
        return true;
      }
    }

    max = Math.max(this.data.group.length, editTree.group.length);
    for (let i = 0; i < max; i++) {
      if (this.data.group[i] !== editTree.group[i]) {
        return true;
      }
    }

    max = Math.max(this.editor.declare.import.length, editTree.import.length);
    for (let i = 0; i < max; i++) {
      const v1: ImportDecl | undefined = this.editor.declare.import[i];
      const v2: ImportDecl | undefined = editTree.import[i];
      if (v1?.path !== v2?.path) {
        return true;
      }
    }

    return false;
  }

  async updateTree(editTree: EditTree) {
    if (this._isTreeUpdated(editTree)) {
      this.data.desc = editTree.desc || "";
      this.data.export = editTree.export !== false;
      this.data.group = editTree.group;
      this.data.prefix = editTree.prefix ?? "";
      this.data.import = editTree.import.map((v) => v.path).sort();
      this.data.vars = editTree.vars
        .map((v) => ({ ...v }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.editor.declare.vars = editTree.vars || [];
      this.editor.declare.import = editTree.import || [];
      workspace.refresh(this.editor.path);
      await this.refresh();
      this._storeHistory();
    }
  }

  async updateNode(editNode: EditNode) {
    const node = this._graph.getNodeData(editNode.data.id);
    const data = node.data as unknown as NodeData;
    if (b3util.isNodeEqual(data, editNode.data)) {
      return;
    }

    // update node
    node.data = { ...editNode.data, size: b3util.calcSize(editNode.data) };
    this._graph.updateNodeData([node]);
    await this._graph.draw();

    // update subtree
    if (data.path !== editNode.data.path) {
      this.editor.data.root = this._nodeToData("1");
      await this.refresh();
    }

    this._storeHistory();
  }

  async refresh() {
    this.selectNode(null);
    await this._update(this.data);
    this.selectNode(null);
  }

  async reload() {
    this.selectNode(null);
    await this._update(readTree(this.editor.path));
    this._storeHistory(false);
    this.selectNode(null);
  }

  async focusNode(id: string) {
    this.selectNode(id);
    await this._graph.translateTo([0, 0], false);
    await this._graph.focusElement(id, true);
  }

  get selectedId() {
    return this._selectedId;
  }

  selectNode(id: string | null) {
    if (this._selectedId && id !== this._selectedId) {
      this._setState(
        this._selectedId,
        this._getState(this._selectedId).filter((v) => v !== "selected")
      );
    }

    this._selectedId = id;

    if (this._selectedId) {
      const node = this._graph.getNodeData(this._selectedId);
      const data = node.data as unknown as NodeData;
      workspace.onEditingNode({
        data: { ...data },
        prefix: this.data.prefix,
        disabled: this._isSubtreeNode(node.id),
        subtreeEditable: !this._isSubtreeNode(this._findParent(node.id)?.id),
      });
      const states = this._getState(this._selectedId);
      this._setState(this._selectedId, [...states, "selected"]);
    } else {
      workspace.onEditingTree(this.editor);
    }
  }

  private _onContextMenu(e: IG6PointerEvent<G6Rect>) {
    this.selectNode(e.target.id);
  }

  private _onCanvasClick(e: IG6PointerEvent<G6Rect>) {
    this.selectNode(null);
  }

  private _onClick(e: IG6PointerEvent<G6Rect>) {
    const names: string[] = [];
    const originalTarget = e.originalTarget;
    if (originalTarget.className === "input-text") {
      const node = this._graph.getNodeData(e.target.id);
      const data = node.data as unknown as NodeData;
      data.input?.forEach((v) => v && names.push(v));
    } else if (originalTarget.className === "output-text") {
      const node = this._graph.getNodeData(e.target.id);
      const data = node.data as unknown as NodeData;
      data.output?.forEach((v) => v && names.push(v));
    }
    this.clickVar(...names);
    this.selectNode(e.target.id);
  }

  private _onDblClick(e: IG6PointerEvent<G6Rect>) {
    this.selectNode(e.target.id);
    this.editSubtree();
  }

  private _isDragState(state: string): boolean {
    return (
      state === "dragsrc" || state === "dragup" || state === "dragdown" || state === "dragright"
    );
  }

  private _isHighlightState(state: string): boolean {
    return (
      state === "highlightgray" ||
      state === "highlightinput" ||
      state === "highlightoutput" ||
      state === "highlightargs"
    );
  }

  private _getState(id: string) {
    return this._graph.getElementState(id) as TreeNodeState[];
  }

  private _setState(id: string, states: TreeNodeState[]) {
    this._graph.setElementState(id, states);
  }

  private _clearDragState(id: string) {
    const states = this._getState(id).filter((v) => !this._isDragState(v));
    this._setState(id, states);
  }

  private _onDragStart(e: IG6PointerEvent<G6Rect>) {
    const { target } = e;
    const states = this._getState(target.id);
    this._setState(target.id, ["dragsrc", ...states]);
    this._dragId = target.id;
    console.log("drag start", target.id);
  }

  private _onDragEnd(e: IG6PointerEvent<G6Rect>) {
    if (!this._dragId) {
      return;
    }
    if (e.target.id !== this._dragId) {
      console.warn("cancel drag", this._dragId, e.target.id);
      this._clearDragState(this._dragId);
    }
    const { target } = e;
    this._clearDragState(target.id);
    this._dragId = undefined;
    console.log("drag end", target.id);
  }

  private _onDragEnter(e: IG6PointerEvent<G6Rect>) {
    const { target } = e;
    if (target.id !== this._dragId) {
      this._dropId = target.id;
    }
  }

  private _onDragLeave(e: IG6PointerEvent<G6Rect>) {
    const { target } = e;
    if (target.id !== this._dragId) {
      this._clearDragState(target.id);
      this._dropId = undefined;
    }
  }

  private _onDrag(e: IG6PointerEvent<G6Rect>) {
    if (!this._dropId) {
      return;
    }
    const id = this._dropId;
    const pos = this._graph.getElementPosition(id);
    const data = this._graph.getNodeData(id).data as unknown as NodeData;
    const [w, h] = data.size!;
    const x = e.canvas.x - pos[0];
    const y = e.canvas.y - pos[1];
    const states = this._getState(id);
    let dragto: TreeNodeState | undefined;
    if (x > w / 2) {
      dragto = "dragright";
    } else if (y > h / 2) {
      dragto = "dragdown";
    } else if (y < h / 2) {
      dragto = "dragup";
    }
    if (dragto && !states.includes(dragto)) {
      // console.log(`drag node: drop=${id} dropto=${dragto}`, states);
      this._setState(id, [dragto, ...states.filter((v) => !this._isDragState(v))]);
    }
  }

  /**
   * 拖放事件处理
   * 
   * 处理节点拖放，实现节点的重组和排序
   * 
   * @param e - 拖放事件
   * 
   * 拖放操作类型：
   * - dragright: 作为子节点添加到目标节点
   * - dragup: 插入到目标节点之前（同级）
   * - dragdown: 插入到目标节点之后（同级）
   * 
   * 验证规则：
   * 1. 不能拖放到自己
   * 2. 不能拖放到自己的子节点（形成循环）
   * 3. 不能在根节点的同级插入
   * 4. 不能拖放到子树节点
   * 
   * 实现流程：
   * 1. 获取源节点和目标节点
   * 2. 确定拖放类型（dragup/dragdown/dragright）
   * 3. 验证操作合法性
   * 4. 执行节点移动
   * 5. 更新图形显示
   * 6. 保存历史记录
   */
  private async _onDrop(e: IG6PointerEvent<G6Rect>) {
    const srcId = this._dragId!;
    const dstId = e.target.id;

    // 清除拖拽状态
    this._dragId = undefined;
    this._dropId = undefined;

    const dstStates = this._getState(e.target.id);
    const dragto: TreeNodeState = dstStates.find((v) => this._isDragState(v))!;

    this._clearDragState(srcId);
    this._clearDragState(dstId);

    // 验证：不能拖放到自己
    if (srcId === e.target.id) {
      console.log("drop same node");
      return;
    }

    // 验证：不能拖放到自己的子节点（防止循环）
    const ancestors = this._getAncestors(dstId);
    if (
      ancestors.some((v) => v.id === srcId) ||
      ((dragto === "dragdown" || dragto === "dragup") && dstId === "1")
    ) {
      message.error(i18n.t("node.dropDenied"));
      return;
    }

    // 验证：不能拖放到子树节点
    if (this._isSubtreeNode(dstId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    console.log(`drop node: drag=${srcId} target=${dstId} dropto=${dragto}`);

    if (e.originalEvent instanceof DragEvent) {
      // const dragEvent = e.originalEvent as DragEvent;
      // const exploreFile = dragEvent.dataTransfer?.getData("explore-file");
      // const exploreNode = dragEvent.dataTransfer?.getData("explore-node");
      // const dstData = findDataById(destNode.getID());
      // if (exploreNode) {
      //   const newTreeData: TreeGraphData = createTreeData(
      //     {
      //       id: editor.autoId++,
      //       name: exploreNode,
      //     },
      //     dstData.id
      //   );
      //   dstData.children ||= [];
      //   dstData.children.push(newTreeData);
      //   refreshItem(dstData);
      //   srcNodeId = newTreeData.id;
      // } else if (exploreFile && exploreFile !== editor.path) {
      //   const newTreeData: TreeGraphData = createTreeData(
      //     {
      //       id: editor.autoId++,
      //       name: "unknow",
      //       path: workspace.relative(exploreFile),
      //     },
      //     dstData.id
      //   );
      //   dstData.children ||= [];
      //   dstData.children.push(newTreeData);
      //   refreshItem(dstData);
      //   srcNodeId = newTreeData.id;
      //   editor.autoId = b3util.refreshTreeDataId(newTreeData, Number(srcNodeId));
      // }
    }

    const root = this._nodeToData("1");

    const srcParentId = this._graph.getParentData(srcId, "tree")?.id;
    const dstParentId = this._graph.getParentData(dstId, "tree")?.id;

    let srcData: NodeData | undefined;
    let dstData: NodeData | undefined;
    let srcParentData: NodeData | undefined;
    let dstParentData: NodeData | undefined;

    b3util.dfs(root, (node) => {
      if (node.id === srcId) {
        srcData = node;
      }
      if (node.id === dstId) {
        dstData = node;
      }
      if (node.id === srcParentId) {
        srcParentData = node;
      }
      if (node.id === dstParentId) {
        dstParentData = node;
      }
    });

    assert(srcData, srcId);
    assert(dstData, dstId);
    assert(srcParentData, srcParentId);

    if (dragto === "dragright") {
      srcParentData.children?.remove(srcData);
      dstData.children ||= [];
      dstData.children.push(srcData);
    } else if (dragto === "dragup") {
      assert(dstParentData, dstParentId);
      srcParentData.children?.remove(srcData);
      const idx = dstParentData.children!.findIndex((v) => v.id === dstId);
      dstParentData.children?.insertAt(idx, srcData);
    } else if (dragto === "dragdown") {
      assert(dstParentData, dstParentId);
      srcParentData.children?.remove(srcData);
      const idx = dstParentData.children!.findIndex((v) => v.id === dstId);
      dstParentData.children?.insertAt(idx + 1, srcData);
    }
    await this._update({ ...this.data, root }, false);
    this._storeHistory();
  }

  /**
   * 复制节点
   * 
   * 将选中的节点（包括其子树）复制到剪贴板
   * 
   * 实现：
   * - 序列化节点数据为 JSON
   * - 写入系统剪贴板
   * - 包含所有子节点
   * 
   * 快捷键：Ctrl+C / Cmd+C
   */
  copyNode() {
    if (this._selectedId) {
      const node = this._graph.getNodeData(this._selectedId);
      if (node) {
        const data = node.data as unknown as NodeData;
        const str = JSON.stringify(b3util.createNode(data));
        clipboard.writeText(str);
      }
    }
  }

  /**
   * 粘贴节点
   * 
   * 将剪贴板中的节点粘贴为选中节点的子节点
   * 
   * 验证：
   * - 必须有选中节点
   * - 不能粘贴到子树节点
   * - 剪贴板数据必须有效
   * 
   * 实现流程：
   * 1. 读取剪贴板 JSON
   * 2. 解析节点数据
   * 3. 添加到选中节点的子节点列表
   * 4. 刷新 ID（避免重复）
   * 5. 更新图形显示
   * 6. 保存历史记录
   * 
   * 快捷键：Ctrl+V / Cmd+V
   */
  async pasteNode() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    try {
      const str = clipboard.readText();
      if (!str || str === "") {
        return;
      }
      console.debug("parse node:", str);

      const root = this._nodeToData("1");
      let dstData: NodeData | undefined;
      b3util.dfs(root, (node) => {
        if (node.id === this._selectedId) {
          dstData = node;
        }
      });

      assert(dstData, this._selectedId);
      dstData.children ||= [];
      dstData.children.push(JSON.parse(str) as NodeData);
      this.selectNode(null);
      await this._update({ ...this.data, root });
      this._storeHistory();
    } catch (error) {
      message.error(i18n.t("node.pasteDataError"));
      console.log(error);
    }
  }

  /**
   * 替换节点
   * 
   * 用剪贴板中的节点替换选中的节点
   * 
   * 验证：
   * - 必须有选中节点
   * - 不能替换子树节点
   * - 剪贴板数据必须有效
   * 
   * 实现流程：
   * 1. 读取剪贴板 JSON
   * 2. 解析节点数据
   * 3. 清空原节点所有属性
   * 4. 复制新节点的所有属性
   * 5. 更新图形显示
   * 6. 保存历史记录
   * 
   * 快捷键：Ctrl+Shift+V / Cmd+Shift+V
   */
  async replaceNode() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    try {
      const str = clipboard.readText();
      if (!str || str === "") {
        return;
      }

      const root = this._nodeToData("1");
      let dstData: NodeData | undefined;
      b3util.dfs(root, (node) => {
        if (node.id === this._selectedId) {
          dstData = node;
        }
      });

      assert(dstData, this._selectedId);
      Object.keys(dstData).forEach((k) => delete (dstData as unknown as ObjectType)[k]);
      Object.assign(dstData, JSON.parse(str));
      this.selectNode(null);
      await this._update({ ...this.data, root });
      this._storeHistory();
    } catch (error) {
      message.error(i18n.t("node.pasteDataError"));
      console.log(error);
    }
  }

  async createNode() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    const root = this._nodeToData("1");
    let dstData: NodeData | undefined;
    b3util.dfs(root, (node) => {
      if (node.id === this._selectedId) {
        dstData = node;
      }
    });

    assert(dstData, this._selectedId);
    dstData.children ||= [];
    dstData.children.push({ id: "", name: "unknow" });
    await this._update({ ...this.data, root });
    this._storeHistory();
  }

  async deleteNode() {
    if (!this._selectedId) {
      return;
    }

    if (this._selectedId === "1") {
      message.error(i18n.t("node.deleteRootNodeDenied"));
      return;
    }

    const subtreeRoot = this._getAncestors(this._selectedId)
      .reverse()
      .find((v) => (v.data as unknown as NodeData)?.path);

    if (subtreeRoot && subtreeRoot.id !== this._selectedId) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    const root = this._nodeToData("1");
    const parentId = this._findParent(this._selectedId)?.id;
    b3util.dfs(root, (n) => {
      if (n.id === parentId) {
        n.children = n.children?.filter((v) => v.id !== this._selectedId);
      }
    });
    this.selectNode(null);
    await this._update({ ...this.data, root });
    this._storeHistory();
  }

  hasSubtreeUpdated() {
    let updated = false;
    b3util.dfs(this.data.root, (node) => {
      if (node.path && b3util.files[node.path] !== node.mtime) {
        updated = true;
      }
    });
    return updated;
  }

  async refreshSubtree() {
    await this.refresh();
    this._storeHistory();
  }

  /**
   * 保存文件
   * 
   * 将当前行为树保存到文件
   * 
   * 验证：
   * - 检查版本兼容性（防止覆盖新版本文件）
   * 
   * 保存流程：
   * 1. 从图形提取最新数据
   * 2. 清理节点数据（移除编辑器专用字段）
   * 3. 写入 JSON 文件
   * 4. 更新文件元数据
   * 
   * 快捷键：Ctrl+S / Cmd+S
   */
  async save() {
    if (b3util.isNewVersion(this.data.version)) {
      message.error(i18n.t("alertNewVersion", { version: this.data.version }), 6);
      return;
    }
    await this._update({ ...this.data, root: this._nodeToData("1") });
    writeTree(this.editor.path, {
      ...this.data,
      root: b3util.createNode(this.data.root),
    });
    workspace.updateFileMeta(this.editor);
  }

  /**
   * 编辑子树
   * 
   * 打开子树文件进行编辑
   * 
   * 实现：
   * 1. 查找选中节点所在的子树根节点
   * 2. 获取子树文件路径
   * 3. 打开子树文件
   * 4. 定位到对应的节点（根据 ID 偏移）
   * 
   * 使用场景：
   * - 双击子树节点
   * - 右键菜单选择"编辑子树"
   * 
   * 节点 ID 偏移计算：
   * - 子树在父树中的 ID 可能不是从 1 开始
   * - 需要计算偏移量定位到子树中的对应节点
   */
  editSubtree() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    const node = this._findSubtreeRoot(this._selectedId);
    const data = node?.data as unknown as NodeData | undefined;
    if (data?.path) {
      const path = `${workspace.workdir}/${data.path}`;
      workspace.open(path, (Number(this._selectedId) - Number(data.id) + 1).toString());
    }
  }

  /**
   * 另存为子树
   * 
   * 将选中的节点及其子树保存为独立的行为树文件
   * 
   * 验证：
   * - 不能保存根节点（根节点就是主树）
   * - 不能保存子树节点（已经是子树了）
   * - 文件路径必须在工作目录内
   * 
   * 实现流程：
   * 1. 弹出文件保存对话框
   * 2. 验证保存路径
   * 3. 提取节点数据（包括子节点）
   * 4. 创建子树 JSON 文件
   * 5. 将原节点转换为子树引用节点
   * 6. 刷新图形显示
   * 7. 保存历史记录
   * 
   * 子树引用：
   * - 原节点的子节点被移除
   * - 添加 path 属性指向子树文件
   * - 子树文件可以被多个树引用
   * 
   * 使用场景：
   * - 复用子树逻辑
   * - 模块化管理
   * - 团队协作（不同人维护不同子树）
   */
  async saveAsSubtree() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._selectedId === "1") {
      message.error(i18n.t("node.subtreeSaveRootError"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    const ret = await dialog.showSaveDialog({
      defaultPath: workspace.workdir.replaceAll("/", Path.sep),
      properties: ["showOverwriteConfirmation"],
      filters: [{ name: "Json", extensions: ["json"] }],
    });

    if (ret.canceled) {
      return;
    }

    const subpath = ret.filePath.replaceAll(Path.sep, "/");
    if (subpath.indexOf(workspace.workdir) === -1) {
      message.error(i18n.t("node.subtreePathError"));
      return;
    }

    const node = this._graph.getNodeData(this._selectedId);
    const data = node.data as unknown as NodeData;
    const subroot = b3util.createFileData(data);
    const subtreeModel = {
      name: Path.basenameWithoutExt(subpath),
      root: subroot,
      desc: data.desc,
    } as TreeData;
    fs.writeFileSync(subpath, JSON.stringify(subtreeModel, null, 2));
    data.path = workspace.relative(subpath);
    this._graph.updateNodeData([node]);
    this.editor.data.root = this._nodeToData("1");
    await this.refresh();
    this._storeHistory();
  }
}
