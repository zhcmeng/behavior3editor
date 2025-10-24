/**
 * 工作区上下文（Workspace Context）
 * 
 * 这是整个行为树编辑器的核心状态管理模块，负责：
 * 1. 管理工作区（Workspace）和项目（Project）
 * 2. 管理所有打开的编辑器（EditorStore）
 * 3. 管理文件树和文件元数据
 * 4. 处理文件的打开、保存、关闭等操作
 * 5. 管理节点定义和变量声明
 * 6. 监听文件系统变化
 * 
 * 使用的设计模式：
 * - Store Pattern: 使用 Zustand 管理全局状态
 * - Observer Pattern: 监听文件系统变化
 * - Singleton Pattern: 全局唯一的工作区实例
 */
import { ipcRenderer } from "electron";
import * as fs from "fs";
import React from "react";
import { create } from "zustand";
import { NodeDef, FileVarDecl, ImportDecl, NodeData, TreeData, VarDecl } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import Path from "../misc/path";
import { zhNodeDef } from "../misc/template";
import { readJson, readTree, readWorkspace, writeJson, writeTree } from "../misc/util";
import { useSetting } from "./setting-context";

/**
 * 全局构建目录缓存
 * 
 * 保存上次选择的构建目录，避免每次构建都要重新选择
 */
let buildDir: string | undefined;

/**
 * 编辑器事件类型
 * 
 * 定义了编辑器可以触发的所有事件，用于组件间通信
 * 
 * 事件分类：
 * - 文件操作: close, save, reload
 * - 编辑操作: copy, paste, replace, delete, insert
 * - 导航操作: jumpNode, searchNode
 * - 撤销重做: undo, redo
 * - 刷新操作: refresh, updateTree, updateNode
 * - 其他操作: rename, editSubtree, saveAsSubtree, clickVar
 */
export type EditEvent =
    | "close"           // 关闭编辑器
    | "save"            // 保存文件
    | "copy"            // 复制节点
    | "paste"           // 粘贴节点
    | "replace"         // 替换节点
    | "delete"          // 删除节点
    | "insert"          // 插入节点
    | "jumpNode"        // 跳转到节点
    | "undo"            // 撤销操作
    | "redo"            // 重做操作
    | "refresh"         // 刷新视图
    | "rename"          // 重命名
    | "reload"          // 重新加载文件
    | "updateTree"      // 更新行为树
    | "updateNode"      // 更新节点
    | "searchNode"      // 搜索节点
    | "editSubtree"     // 编辑子树
    | "saveAsSubtree"   // 另存为子树
    | "clickVar";       // 点击变量

/**
 * 编辑器存储类（EditorStore）
 * 
 * 表示一个打开的行为树文件的编辑器实例
 * 每个打开的 .json 文件都对应一个 EditorStore
 * 
 * 职责：
 * - 加载和保存行为树文件
 * - 跟踪文件修改状态
 * - 管理变量声明
 * - 处理文件变更检测
 * - 分发编辑事件
 * 
 * 生命周期：
 * 1. 用户打开文件 -> 创建 EditorStore
 * 2. 编辑过程中 -> 更新 changed 状态
 * 3. 用户关闭文件 -> 销毁 EditorStore
 */
export class EditorStore {
    /** 文件的完整路径 */
    path: string;

    /** 行为树数据（JSON 结构） */
    data: TreeData;

    /** 
     * 变量声明信息
     * 
     * 包含：
     * - import: 导入的其他树的变量
     * - subtree: 子树的变量
     * - vars: 当前树定义的变量
     */
    declare: FileVarDecl;

    /** 文件是否已修改（未保存） */
    changed: boolean = false;

    /** 文件的最后修改时间（毫秒时间戳） */
    mtime: number;

    /** 是否需要提示重新加载（文件在外部被修改时） */
    alertReload: boolean = false;

    /** 当前聚焦的节点 ID */
    focusId?: string | null;

    /** 
     * 事件分发函数
     * 
     * 用于向编辑器组件发送事件，例如：
     * - dispatch("save") - 保存文件
     * - dispatch("refresh") - 刷新视图
     * - dispatch("reload") - 重新加载文件
     */
    dispatch?: (event: EditEvent, data?: unknown) => void;

    /**
     * 构造函数
     * 
     * @param path - 行为树文件路径
     * 
     * 初始化流程：
     * 1. 读取文件内容
     * 2. 设置文件名
     * 3. 记录修改时间
     * 4. 初始化变量声明
     */
    constructor(path: string) {
        this.path = path;
        this.data = readTree(path);
        this.data.name = Path.basenameWithoutExt(path);
        this.mtime = fs.statSync(path).mtimeMs;
        this.declare = {
            import: this.data.import.map((v) => ({ path: v, vars: [], depends: [] })),
            subtree: [],
            vars: this.data.vars.map((v) => ({ ...v })),
        };
    }
}

/**
 * 文件树节点类型
 * 
 * 用于在侧边栏展示文件树结构
 * 支持文件和文件夹的递归显示
 * 
 * 使用场景：
 * - Explorer 组件的文件树
 * - 文件导航和浏览
 */
export type FileTreeType = {
    /** 文件/文件夹的完整路径 */
    path: string;

    /** 显示的标题（文件名或文件夹名） */
    title: string;

    /** 可选的图标（React 组件） */
    icon?: React.ReactNode;

    /** 描述信息 */
    desc?: string;

    /** 是否为叶子节点（文件） */
    isLeaf?: boolean;

    /** 子节点（文件夹包含的文件和子文件夹） */
    children?: FileTreeType[];

    /** 是否正在编辑（重命名状态） */
    editing?: boolean;

    /** 自定义样式 */
    style?: React.CSSProperties;
};

/**
 * 正在编辑的节点信息
 * 
 * 当用户在属性面板中编辑节点时使用
 * 包含节点数据和状态信息
 */
export type EditNode = {
    /** 节点数据 */
    data: NodeData;

    /** 节点是否有错误（显示红色） */
    error?: boolean;

    /** 节点前缀（用于显示路径） */
    prefix: string;

    /** 节点是否被禁用 */
    disabled: boolean;

    /** 子树是否可编辑 */
    subtreeEditable?: boolean;
};

/**
 * 正在编辑的节点定义
 * 
 * 当用户查看或编辑节点定义时使用
 * 显示在属性面板中
 */
export type EditNodeDef = {
    /** 节点定义数据 */
    data: NodeDef;

    /** 节点定义文件路径（如果来自外部文件） */
    path?: string;
};

/**
 * 正在编辑的行为树信息
 * 
 * 当用户编辑树的全局属性时使用
 * 包含树的元数据和设置
 */
export type EditTree = {
    /** 树的名称 */
    name: string;

    /** 树的描述 */
    desc?: string;

    /** 是否导出（在构建时包含） */
    export?: boolean;

    /** 树的前缀（用于命名空间） */
    prefix?: string;

    /** 启用的节点分组 */
    group: string[];

    /** 导入的其他树 */
    import: ImportDecl[];

    /** 树定义的变量 */
    vars: VarDecl[];

    /** 子树列表 */
    subtree: ImportDecl[];

    /** 根节点 */
    root: NodeData;
};

/**
 * 文件元数据
 * 
 * 存储在工作区配置中，用于：
 * - 记录文件描述
 * - 跟踪文件是否存在
 * - 快速访问文件信息
 */
export type FileMeta = {
    /** 文件路径（相对于工作区） */
    path: string;

    /** 文件描述 */
    desc?: string;

    /** 文件是否存在于磁盘 */
    exists?: boolean;
};

/**
 * 工作区配置模型
 * 
 * 存储在 .b3-workspace 文件中的 JSON 结构
 * 定义了工作区的设置和文件列表
 */
export interface WorkspaceModel {
    /** 工作区设置 */
    settings: {
        /** 是否检查表达式语法 */
        checkExpr?: boolean;
        /** 构建脚本路径 */
        buildScript?: string;
        /** 日志文件路径 */
        logPath?: string;
    };
}

/**
 * 工作区存储接口（WorkspaceStore）
 * 
 * 使用 Zustand 创建的全局状态管理 Store
 * 这是整个应用的核心状态中心
 * 
 * 功能模块：
 * 1. 项目管理: 创建、打开、构建项目
 * 2. 文件管理: 打开、关闭、保存文件
 * 3. 编辑器管理: 多标签页编辑
 * 4. 节点管理: 节点定义和编辑
 * 5. 文件系统监听: 自动检测文件变化
 */
export type WorkspaceStore = {
    // ============ 项目操作 ============

    /** 初始化工作区（加载项目） */
    init: (project: string) => void;

    /** 创建新项目 */
    createProject: () => Promise<void>;

    /** 打开已有项目 */
    openProject: (project?: string) => Promise<void>;

    /** 批量处理项目（运行脚本） */
    batchProject: () => Promise<void>;

    /** 构建项目（导出所有树） */
    buildProject: () => Promise<void>;

    // ============ 工作区状态 ============

    /** 工作区设置 */
    settings: WorkspaceModel["settings"];

    /** 工作目录（项目根目录） */
    workdir: string;

    /** 工作区文件路径（.b3-workspace） */
    path: string;

    // ============ 设置操作 ============

    /** 设置表达式检查开关 */
    setCheckExpr: (checkExpr: boolean) => void;/**
    * 设置构建脚本
    */
    setupBuildScript: () => Promise<void>;

    // ============ 工作区文件操作 ============

    /** 加载工作区配置 */
    loadWorkspace: () => void;

    /** 保存工作区配置 */
    saveWorkspace: () => void;

    /** 更新文件元数据 */
    updateFileMeta: (editor: EditorStore) => void;

    // ============ 文件和编辑器管理 ============

    /** 所有文件的元数据映射 */
    allFiles: Map<string, FileMeta>;

    /** 文件树结构（用于 UI 显示） */
    fileTree?: FileTreeType;

    /** 所有打开的编辑器 */
    editors: EditorStore[];

    /** 当前正在编辑的编辑器 */
    editing?: EditorStore;

    /** 文件修改时间戳（用于触发刷新） */
    modifiedTime: number;

    // ============ 搜索功能 ============

    /** 是否显示搜索面板 */
    isShowingSearch: boolean;

    /** 设置搜索面板显示状态 */
    onShowingSearch: (isShowingSearch: boolean) => void;

    // ============ 编辑器操作 ============

    /** 打开文件（如果未打开则创建编辑器） */
    open: (path: string, focusId?: string) => void;

    /** 切换到指定文件的编辑器 */
    edit: (path: string, focusId?: string) => void;

    /** 关闭文件编辑器 */
    close: (path: string) => void;

    /** 查找指定路径的编辑器 */
    find: (path: string) => EditorStore | undefined;

    /** 获取相对于工作区的路径 */
    relative: (path: string) => string;

    /** 刷新编辑器（重新计算变量等） */
    refresh: (path: string) => void;

    // ============ 保存操作 ============

    /** 保存当前文件 */
    save: () => void;

    /** 另存为 */
    saveAs: () => void;

    /** 保存所有文件 */
    saveAll: () => void;

    // ============ 文件系统监听 ============

    /** 开始监听文件系统变化 */
    watch(): void;

    /** 加载所有行为树文件 */
    loadTrees: () => void;

    /** 根据文件路径和内容自动生成文件描述 */
    getFileDescription: (relativePath: string, fullPath: string) => string;

    // ============ 节点定义管理 ============

    /** 加载节点定义配置 */
    loadNodeDefs: () => void;

    /** 所有节点定义 */
    nodeDefs: b3util.NodeDefs;

    /** 所有分组定义 */
    groupDefs: string[];

    /** 当前启用的分组 */
    usingGroups: typeof b3util.usingGroups;

    /** 当前可用的变量 */
    usingVars: typeof b3util.usingVars;

    // ============ 编辑状态管理 ============

    /** 正在编辑的节点 */
    editingNode?: EditNode | null;

    /** 设置正在编辑的节点 */
    onEditingNode: (node: EditNode) => void;

    /** 正在查看的节点定义 */
    editingNodeDef?: EditNodeDef | null;

    /** 设置正在查看的节点定义 */
    onEditingNodeDef: (node: EditNodeDef) => void;

    /** 正在编辑的树属性 */
    editingTree?: EditTree | null;

    /** 设置正在编辑的树属性 */
    onEditingTree: (editor: EditorStore) => void;
};

/**
 * 加载文件树（递归）
 * 
 * 从文件系统读取目录结构并构建文件树数据
 * 用于在侧边栏 Explorer 组件中显示
 * 
 * @param workdir - 工作目录（项目根目录）
 * @param filename - 相对于工作目录的文件/文件夹名
 * @returns 文件树节点，如果文件不存在则返回 undefined
 * 
 * 递归逻辑：
 * 1. 如果是文件夹：递归加载所有子文件和子文件夹
 * 2. 如果是文件：标记为叶子节点
 * 
 * 排序规则：
 * - 文件夹优先于文件
 * - 同级按字母顺序排序
 */
const loadFileTree = (workdir: string, filename: string) => {
    const fullpath = Path.posixPath(`${workdir}/${filename}`);

    // 跳过不存在的文件、macOS 系统文件和 nodes 目录（包括子目录中的 nodes 目录）
    if (!fs.existsSync(fullpath) || filename.endsWith(".DS_Store") ||
        filename.includes("/nodes") || filename === "nodes") {
        return;
    }

    const stat = fs.statSync(fullpath);

    const data: FileTreeType = {
        path: fullpath.replaceAll(Path.sep, "/"),
        title: Path.basename(filename),
    };

    if (stat.isDirectory()) {
        // 处理文件夹：递归加载子项
        data.children = [];
        const files = fs.readdirSync(data.path);
        files.forEach((v) => {
            const child = loadFileTree(workdir, `${filename}/${v}`);
            if (child) {
                data.children?.push(child);
            }
        });

        // 排序：文件夹在前，文件在后，同级按字母顺序
        data.children.sort((a, b) => {
            if ((a.children && b.children) || (!a.children && !b.children)) {
                return a.title.localeCompare(b.title);
            } else {
                return a.children ? -1 : 1;
            }
        });

        // 如果文件夹为空或只包含非JSON文件，则不显示该文件夹
        if (data.children.length === 0) {
            return;
        }
    } else {
        // 处理文件：只显示JSON文件
        if (!filename.toLowerCase().endsWith('.json')) {
            return;
        }
        data.isLeaf = true;
    }
    return data;
};

/**
 * 保存文件
 * 
 * 如果编辑器有未保存的修改，触发保存事件
 * 
 * @param editor - 编辑器实例
 * 
 * 使用场景：
 * - 用户点击保存按钮
 * - 自动保存
 * - 关闭前保存
 */
const saveFile = (editor?: EditorStore) => {
    if (editor?.changed) {
        editor.dispatch?.("save");
    }
};

/**
 * 工作区状态管理 Store
 * 
 * 使用 Zustand 创建的全局状态管理
 * 这是整个应用的核心 Store，管理所有工作区相关的状态和操作
 * 
 * 架构设计：
 * - 使用 Zustand 的 create 方法创建 store
 * - 所有状态和方法都在一个对象中定义
 * - 通过 set/get 函数更新和读取状态
 * 
 * 使用方式：
 * ```typescript
 * const workspace = useWorkspace();
 * workspace.init(projectPath);
 * workspace.open(filePath);
 * ```
 */
export const useWorkspace = create<WorkspaceStore>((set, get) => ({
    // ============ 初始状态 ============

    /** 所有文件的元数据映射 */
    allFiles: new Map(),

    /** 文件树结构 */
    fileTree: undefined,

    /** 所有打开的编辑器列表 */
    editors: [],

    /** 工作目录路径 */
    workdir: "",

    /** 工作区文件路径 */
    path: "",

    /** 工作区设置 */
    settings: {},

    /**
     * 初始化工作区
     * 
     * 这是打开项目后的第一个调用，负责：
     * 1. 加载工作区配置
     * 2. 加载文件树
     * 3. 加载节点定义
     * 4. 恢复上次打开的文件
     * 5. 开始监听文件系统变化
     * 
     * @param path - 工作区文件路径（.b3-workspace）
     * 
     * 调用时机：
     * - 用户打开项目
     * - 应用启动时恢复上次项目
     */
    init: (path) => {
        const workspace = get();
        const setting = useSetting.getState();
        const files = setting.getEditors(path);
        if (!workspace.workdir) {
            try {
                workspace.workdir = Path.dirname(path).replaceAll(Path.sep, "/");
                workspace.path = path;
                workspace.loadWorkspace();
                workspace.loadTrees();
                workspace.loadNodeDefs();
                workspace.watch();
                setting.appendRecent(path);
                if (files.length) {
                    for (const entry of files) {
                        try {
                            if (fs.existsSync(entry.path)) {
                                entry.path = Path.posixPath(entry.path);
                                const editor = new EditorStore(entry.path);
                                workspace.editors.push(editor);
                                if (entry.active) {
                                    workspace.open(editor.path);
                                }
                            } else {
                                setting.closeEditor(workspace.path, entry.path);
                            }
                        } catch (error) {
                            console.error(error);
                            message.error(`invalid file: ${path}`);
                        }
                    }
                }
            } catch (error) {
                console.error(error);
                if (!fs.existsSync(path)) {
                    useSetting.getState().removeRecent(path);
                }
                message.error(`load workspace error: ${path}`);
            }
        }
    },

    // setting
    setCheckExpr: (checkExpr: boolean) => {
        const { settings, saveWorkspace } = get();
        set({
            settings: {
                ...settings,
                checkExpr,
            },
        });
        b3util.setCheckExpr(checkExpr);
        saveWorkspace();
        get().editing?.dispatch?.("refresh");
    },

    setupBuildScript: async () => {
        const workspace = get();
        const buildScripts = await ipcRenderer.invoke("show-open-dialog", {
            properties: ["openFile"],
            defaultPath: workspace.workdir.replaceAll("/", Path.sep),
            filters: [{ name: "Javascript", extensions: ["js"] }],
        });
        const buildScript = buildScripts?.[0];
        if (buildScript) {
            const posixPath = Path.posixPath(buildScript);
            const { settings, saveWorkspace, relative } = get();
            set({
                settings: {
                    ...settings,
                    buildScript: relative(posixPath),
                },
            });
            saveWorkspace();
        }
    },

    createProject: async () => {
        const path = await ipcRenderer.invoke("show-save-dialog", {
            properties: ["showOverwriteConfirmation", "createDirectory"],
            filters: [{ name: "Behavior3 Workspace", extensions: ["b3-workspace"] }],
        });
        if (path) {
            const workspace = get();
            fs.writeFileSync(Path.dirname(path) + "/node-config.b3-setting", zhNodeDef());
            fs.writeFileSync(
                Path.dirname(path) + "/example.json",
                JSON.stringify(
                    {
                        name: "example",
                        root: {
                            id: 1,
                            name: "Sequence",
                            children: [
                                {
                                    id: 2,
                                    name: "Log",
                                    args: {
                                        str: "hello",
                                    },
                                },
                                {
                                    id: 3,
                                    name: "Wait",
                                    args: {
                                        time: 1,
                                    },
                                },
                            ],
                        },
                    },
                    null,
                    2
                )
            );
            fs.writeFileSync(
                path,
                JSON.stringify(
                    {
                        nodeConf: "node-config.b3-setting",
                        metadata: [],
                    },
                    null,
                    2
                )
            );
            workspace.init(path);
        }
    },

    openProject: async (project?: string) => {
        if (project) {
            ipcRenderer.invoke("open-win", project);
        } else {
            const paths = await ipcRenderer.invoke("show-open-dialog", {
                filters: [{ name: "workspace", extensions: ["b3-workspace"] }],
            });
            if (paths?.length) {
                ipcRenderer.invoke("open-win", paths[0]);
            }
        }
    },

    /**
     * 构建项目
     * 
     * 将所有行为树文件导出到构建目录
     * 
     * 构建流程：
     * 1. 选择构建目录（如果未选择）
     * 2. 保存所有未保存的文件
     * 3. 调用 b3util.buildProject 执行构建
     * 4. 显示构建结果
     * 
     * 构建过程：
     * - 验证所有行为树
     * - 导出为 JSON 文件
     * - 可选：运行自定义构建脚本
     * 
     * @async
     */
    buildProject: async () => {
        const workspace = get();
        const setting = useSetting.getState();

        // 选择构建目录
        if (workspace.path) {
            if (!buildDir) {
                const buildDirs = await ipcRenderer.invoke("show-open-dialog", {
                    properties: ["openDirectory", "createDirectory"],
                    defaultPath: setting.getBuildDir(workspace.path),
                });
                buildDir = buildDirs?.[0];
            }
        }

        if (buildDir) {
            // 保存所有打开的文件
            for (const editor of workspace.editors) {
                editor.dispatch?.("save");
            }

            // 临时禁用 debug 输出
            const debug = console.debug;
            console.debug = () => { };

            try {
                // 执行构建
                const hasError = await b3util.buildProject(workspace.path, buildDir);
                if (hasError) {
                    message.error(i18n.t("buildFailed"));
                } else {
                    message.success(i18n.t("buildCompleted"));
                }
                setting.setBuildDir(workspace.path, buildDir);
            } catch (error) {
                console.error(error);
                message.error(i18n.t("buildFailed"));
            }

            // 刷新当前编辑器
            if (workspace.editing) {
                workspace.refresh(workspace.editing.path);
            }

            // 恢复 debug 输出
            console.debug = debug;
        }
    },

    batchProject: async () => {
        const workspace = get();
        const scriptPaths = await ipcRenderer.invoke("show-open-dialog", {
            properties: ["openFile"],
            defaultPath: workspace.workdir.replaceAll("/", Path.sep),
            filters: [{ name: "Javascript", extensions: ["js"] }],
        });
        const scriptPath = scriptPaths?.[0];
        if (scriptPath) {
            let hasError = false;
            try {
                console.log("run script", scriptPath);
                const batch = await b3util.loadModule(scriptPath);
                batch.onSetup?.({
                    fs,
                    path: Path,
                    workdir: workspace.workdir,
                    nodeDefs: get().nodeDefs,
                });
                workspace.allFiles.forEach((file) => {
                    let tree: TreeData | null = readTree(file.path);
                    const errors: string[] = [];
                    tree = b3util.processBatch(tree, file.path, batch, errors);
                    if (errors.length) {
                        errors.forEach((error) => message.error(error));
                        hasError = true;
                    }
                    if (tree) {
                        batch.onWriteFile?.(file.path, tree);
                        writeTree(file.path, tree);
                    }
                });
                batch.onComplete?.("success");
            } catch (error) {
                hasError = true;
                console.error(error);
            }
            if (workspace.editing) {
                workspace.refresh(workspace.editing.path);
            }
            if (hasError) {
                message.error(i18n.t("batchFailed"));
            } else {
                message.success(i18n.t("batchCompleted"));
            }
        }
    },

    loadWorkspace: () => {
        const workspace = get();
        const data = readWorkspace(workspace.path);
        set({ settings: data.settings });
        b3util.setCheckExpr(data.settings?.checkExpr ?? true);

        // 不再从配置文件加载 files 字段
        // 文件列表将通过 loadTrees() 自动扫描生成

        process.chdir(Path.dirname(workspace.path));
    },

    saveWorkspace: () => {
        const workspace = get();
        const data: WorkspaceModel = {
            settings: workspace.settings,
        };
        // 不再保存 files 字段，完全依赖文件系统扫描
        writeJson(workspace.path, data);
    },

    updateFileMeta: (editor) => {
        const workspace = get();
        const path = workspace.relative(editor.path);
        const file = workspace.allFiles.get(path);
        if (file && file.desc !== editor.data.desc) {
            // 更新文件描述（从文件内容自动生成）
            file.desc = workspace.getFileDescription(path, editor.path);
            set({ allFiles: new Map(workspace.allFiles) });
            // 不再需要保存工作区配置，描述信息从文件内容自动获取
        }
    },

    modifiedTime: 0,

    isShowingSearch: false,
    onShowingSearch: (isShowingSearch) => {
        set({ isShowingSearch });
    },

    open: (path, focusId) => {
        path = Path.posixPath(path);
        const workspace = get();
        let editor = workspace.editors.find((v) => v.path === path);
        if (!editor) {
            try {
                editor = new EditorStore(path);
                workspace.editors.push(editor);
                set({ editors: workspace.editors });
                workspace.updateFileMeta(editor);
                workspace.edit(editor.path, focusId);

                if (b3util.isNewVersion(editor.data.version)) {
                    message.warning(i18n.t("alertNewVersion", { version: editor.data.version }));
                }
            } catch (error) {
                console.error(error);
                message.error(`invalid file: ${path}`);
            }
        } else if (workspace.editing !== editor) {
            workspace.edit(editor.path, focusId);
        }
    },

    edit: (path, focusId) => {
        const workspace = get();
        const editor = workspace.editors.find((v) => v.path === path);
        if (editor) {
            editor.focusId = focusId;
        }
        set({ editing: editor, editingNode: null, editingTree: null });
        if (editor) {
            workspace.onEditingTree(editor);
        }
    },

    close: (path) => {
        const workspace = get();
        const setting = useSetting.getState();
        const idx = workspace.editors.findIndex((v) => v.path === path);
        const editors = workspace.editors.filter((v) => v.path !== path);
        const editor = workspace.editors.find((v) => v.path === path);
        let editting = workspace.editing;
        editor?.dispatch?.("close");
        if (editors.length && path === editting?.path) {
            editting = editors[idx === editors.length ? idx - 1 : idx];
            workspace.onEditingTree(editting);
        }
        if (editors.length === 0) {
            editting = undefined;
            set({ editingNode: undefined, editingTree: undefined });
        }
        set({ editing: editting, editors: editors });
        setting.closeEditor(workspace.path, path);
    },

    find: (path) => {
        const workspace = get();
        return workspace.editors.find((v) => v.path === path);
    },

    relative: (path: string) => {
        const workspace = get();
        return Path.relative(workspace.workdir, path).replaceAll(Path.sep, "/");
    },

    refresh: (path: string) => {
        const workspace = get();
        const editor = workspace.editors.find((v) => v.path === path);
        if (!editor) {
            return false;
        }
        b3util.refreshVarDecl(editor.data.root, editor.data.group, editor.declare);
        set({
            usingGroups: b3util.usingGroups,
            usingVars: b3util.usingVars,
        });
    },

    save: () => {
        const workspace = get();
        saveFile(workspace.editing);
    },

    saveAs: () => { },

    saveAll: () => {
        const workspace = get();
        for (const editor of workspace.editors) {
            saveFile(editor);
        }
    },

    /**
     * 监听文件系统变化
     * 
     * 使用 Node.js fs.watch 监听工作目录的所有文件变化
     * 
     * 监听事件：
     * 1. **rename 事件**：文件/文件夹被创建、删除、重命名
     *    - 防抖处理（200ms）
     *    - 重新加载文件树
     * 
     * 2. **change 事件**：文件内容被修改
     *    - node-config.b3-setting：重新加载节点定义
     *    - 其他文件：检查是否需要重新加载编辑器
     * 
     * 文件变更处理：
     * - 如果编辑器有未保存修改：提示重新加载
     * - 如果编辑器无修改：自动重新加载
     * 
     * 注意事项：
     * - 使用 500ms 延迟避免保存时误触发
     * - 递归监听整个工作目录
     */
    watch: () => {
        try {
            const workspace = get();
            let hasEvent = false;

            fs.watch(workspace.workdir, { recursive: true }, (event, filename) => {
                // 处理文件重命名事件（创建、删除、重命名）
                if (event === "rename") {
                    if (!hasEvent) {
                        setTimeout(() => {
                            workspace.loadTrees();
                            hasEvent = false;
                        }, 200); // 防抖：200ms 内多次事件只处理一次
                        hasEvent = true;
                    }
                }

                // 处理文件内容变更事件
                if (filename && (event === "change" || workspace.allFiles.has(filename))) {
                    if (filename === "node-config.b3-setting") {
                        // 节点配置文件变更：重新加载节点定义
                        workspace.loadNodeDefs();
                    } else {
                        // 行为树文件变更：检查编辑器状态
                        const fullpath = Path.posixPath(`${workspace.workdir}/${filename}`);
                        const editor = workspace.find(fullpath);
                        const modified = fs.statSync(fullpath).mtimeMs;
                        b3util.files[Path.posixPath(filename)] = modified;

                        if (editor && editor.mtime + 500 < modified) {
                            // 500ms 延迟避免保存时误触发
                            if (editor.changed) {
                                // 有未保存修改：提示重新加载
                                editor.alertReload = true;
                                set({ modifiedTime: Date.now() });
                            } else {
                                // 无修改：自动重新加载
                                editor.dispatch?.("reload");
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error(e);
        }
    },

    /**
     * 自动识别文件类型并生成描述
     * 
     * @param relativePath 相对路径
     * @param fullPath 完整路径
     * @returns 文件描述
     */
    getFileDescription: (relativePath: string, fullPath: string): string => {
        // 基于路径和文件名自动识别文件类型
        if (relativePath.startsWith("nodes/") && relativePath.endsWith(".json")) {
            // 节点定义文件
            try {
                const nodeData = readJson(fullPath) as NodeDef;
                return nodeData.desc || `${nodeData.name} 节点`;
            } catch {
                return "节点定义文件";
            }
        } else if (relativePath.startsWith("trees/") && relativePath.endsWith(".json")) {
            // 行为树文件
            try {
                const treeData = readJson(fullPath) as TreeData;
                return treeData.desc || `${treeData.name} 行为树`;
            } catch {
                return "行为树文件";
            }
        } else if (relativePath.startsWith("cfg/") && relativePath.endsWith(".json")) {
            // 配置文件
            return "配置文件";
        } else if (relativePath.startsWith("vars/") && relativePath.endsWith(".json")) {
            // 变量定义文件
            return "变量定义文件";
        } else if (relativePath.startsWith("scripts/") && relativePath.endsWith(".js")) {
            // 脚本文件
            return "构建脚本";
        } else if (relativePath.endsWith(".json")) {
            // 其他 JSON 文件，尝试读取描述
            try {
                const data = readJson(fullPath) as any;
                if (data.desc) {
                    return data.desc;
                } else if (data.name) {
                    return `${data.name} 文件`;
                }
            } catch {
                // 忽略读取错误
            }
            return "JSON 文件";
        } else if (relativePath.endsWith(".js")) {
            return "JavaScript 文件";
        } else if (relativePath.endsWith(".md")) {
            return "文档文件";
        } else {
            return "文件";
        }
    },

    /**
     * 加载文件树（自适应版本）
     * 
     * 完全基于文件系统扫描，自动识别文件类型和用途
     * 
     * 处理流程：
     * 1. 递归加载文件树结构
     * 2. 自动收集所有相关文件（JSON、JS、MD等）
     * 3. 基于路径和内容自动识别文件类型
     * 4. 自动生成合适的文件描述
     * 5. 更新文件元数据和修改时间缓存
     * 
     * 文件类型自动识别：
     * - nodes/*.json → 节点定义文件
     * - trees/*.json → 行为树文件
     * - cfg/*.json → 配置文件
     * - vars/*.json → 变量定义文件
     * - scripts/*.js → 脚本文件
     * - *.md → 文档文件
     * 
     * 调用时机：
     * - 初始化工作区
     * - 文件系统 rename 事件触发
     * - 用户手动刷新
     */
    loadTrees: () => {
        const workspace = get();

        // 加载文件树结构
        const data = loadFileTree(workspace.workdir, ".")!;
        data.title = Path.basename(workspace.workdir).toUpperCase();
        data.style = {
            fontWeight: "bold",
            fontSize: "13px",
        };
        set({ fileTree: data });

        // 重新构建文件元数据映射
        const allFiles = new Map<string, FileMeta>();

        // 递归收集所有相关文件
        const collect = (fileNode?: FileTreeType) => {
            if (fileNode?.isLeaf) {
                const relativePath = workspace.relative(fileNode.path);

                // 只收集相关的文件类型，但排除 nodes 目录下的文件
                if ((relativePath.endsWith(".json") ||
                    relativePath.endsWith(".js") ||
                    relativePath.endsWith(".md") ||
                    relativePath.includes("node-config.b3-setting")) &&
                    !relativePath.startsWith("nodes/")) {

                    const fileMeta: FileMeta = {
                        path: fileNode.path,
                        exists: fs.existsSync(fileNode.path),
                        desc: workspace.getFileDescription(relativePath, fileNode.path)
                    };

                    allFiles.set(relativePath, fileMeta);

                    // 缓存文件修改时间
                    if (fileMeta.exists) {
                        b3util.files[relativePath] = fs.statSync(fileNode.path).mtimeMs;
                    }
                }
            }
            fileNode?.children?.forEach((child) => collect(child));
        };

        collect(data);

        // 清理旧的文件时间缓存
        Object.keys(b3util.files).forEach(key => {
            if (!allFiles.has(key)) {
                delete b3util.files[key];
            }
        });

        set({ allFiles });

        console.log(`自动发现 ${allFiles.size} 个文件`);
    },

    nodeDefs: new b3util.NodeDefs(),
    groupDefs: [],
    usingGroups: null,
    usingVars: null,
    loadNodeDefs: () => {
        const workspace = get();
        b3util.initWorkdir(workspace.workdir, message.error.bind(message));
        set({ nodeDefs: b3util.nodeDefs, groupDefs: b3util.groupDefs });
        workspace.editing?.dispatch?.("refresh");
    },

    // node edit
    onEditingNode: (node) => {
        set({ editingNode: node, editingNodeDef: null, editingTree: null });
    },

    onEditingNodeDef: (nodeDef) => {
        set({ editingNodeDef: nodeDef, editingNode: null, editingTree: null });
    },

    // tree edit
    onEditingTree: (editor) => {
        const workspace = get();
        const setting = useSetting.getState();
        workspace.refresh(editor.path);
        setting.openEditor(workspace.path, editor.path);
        set({
            editingTree: {
                ...editor.data,
                root: editor.data.root,
                import: editor.declare.import,
                subtree: editor.declare.subtree,
                vars: editor.declare.vars,
            },
            editingNodeDef: null,
            editingNode: null,
        });
    },
}));
