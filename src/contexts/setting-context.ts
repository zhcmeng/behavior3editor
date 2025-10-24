/**
 * 设置上下文（Setting Context）
 * 
 * 管理应用程序的全局设置和用户偏好
 * 
 * 功能：
 * 1. 最近打开的项目列表
 * 2. 节点布局偏好（紧凑/正常）
 * 3. 每个项目的设置（构建目录、打开的编辑器）
 * 
 * 持久化：
 * - 设置保存在用户数据目录的 settings.json 文件中
 * - Windows: %APPDATA%/behavior3editor/settings.json
 * - macOS: ~/Library/Application Support/behavior3editor/settings.json
 * - Linux: ~/.config/behavior3editor/settings.json
 * 
 * 使用 Zustand 管理状态，跨应用会话持久化
 */
import { ipcRenderer } from "electron";
import * as fs from "fs";
import { create } from "zustand";
import { NodeLayout } from "../misc/b3type";
import { readJson, writeJson } from "../misc/util";
import { useWorkspace } from "./workspace-context";

/**
 * 获取设置文件路径
 * 
 * 存储在 Electron 的 userData 目录下
 * 每个用户有独立的设置文件
 */
const getSettingPath = async (): Promise<string> => {
  const userDataPath = await ipcRenderer.invoke("get-app-path", "userData");
  return userDataPath + "/settings.json";
};

/**
 * 打开的编辑器信息
 * 
 * 记录项目中打开的文件和激活状态
 * 用于恢复上次的工作会话
 */
export type OpenEditor = {
    /** 文件路径 */
    path: string;
    
    /** 是否为当前激活的编辑器 */
    active: boolean;
};

/**
 * 项目设置
 * 
 * 每个项目的独立设置
 * 包括构建目录和打开的编辑器列表
 */
export type ProjectSetting = {
    /** 项目路径（.b3-workspace 文件路径） */
    path: string;
    
    /** 构建输出目录 */
    buildDir: string;
    
    /** 打开的编辑器列表 */
    editors: OpenEditor[];
};

/**
 * 日志级别枚举
 * 
 * 定义了调试日志的不同级别
 */
export enum LogLevel {
    /** 调试级别 - 详细的调试信息 */
    DEBUG = "debug",
    /** 信息级别 - 一般信息 */
    INFO = "info",
    /** 警告级别 - 警告信息 */
    WARN = "warn",
    /** 错误级别 - 错误信息 */
    ERROR = "error",
}

/**
 * 设置数据模型
 * 
 * 存储在 settings.json 中的 JSON 结构
 */
export type SettingModel = {
    /** 最近打开的项目列表 */
    recent: string[];
    
    /** 节点显示布局（紧凑/正常） */
    layout: NodeLayout;
    
    /** 所有项目的设置 */
    projects: ProjectSetting[];
    
    /** 日志级别设置 */
    logLevel?: LogLevel;
};

/**
 * 设置存储接口
 * 
 * 管理应用程序全局设置的 Zustand Store
 * 
 * 功能模块：
 * 1. 设置持久化：加载和保存设置
 * 2. 最近项目：管理最近打开的项目列表
 * 3. 布局设置：节点显示布局偏好
 * 4. 项目设置：每个项目的构建目录和编辑器状态
 */
export type SettingStore = {
    /** 设置数据 */
    data: SettingModel;

    /** 从文件加载设置 */
    load: () => Promise<void>;
    
    /** 保存设置到文件 */
    save: () => Promise<void>;
    
    /** 添加到最近项目列表 */
    appendRecent: (path: string) => void;
    
    /** 从最近项目列表移除 */
    removeRecent: (path: string) => void;
    
    /** 设置节点布局 */
    setLayout: (layout: "compact" | "normal") => void;
    
    /** 设置项目的构建目录 */
    setBuildDir: (project: string, dir: string) => void;
    
    /** 获取项目的构建目录 */
    getBuildDir: (project: string) => string;
    
    /** 记录打开的编辑器 */
    openEditor: (project: string, path: string) => void;
    
    /** 记录关闭的编辑器 */
    closeEditor: (project: string, path: string) => void;
    
    /** 获取项目的编辑器列表 */
    getEditors: (project: string) => OpenEditor[];
    
    /** 设置日志级别 */
    setLogLevel: (logLevel: LogLevel) => void;
    
    /** 获取日志级别 */
    getLogLevel: () => LogLevel;
};

/**
 * 设置状态管理 Store
 * 
 * 使用 Zustand 创建的全局设置管理
 * 负责持久化用户偏好和项目设置
 * 
 * 设计模式：
 * - 自动保存：每次修改后自动保存到文件
 * - 懒加载：应用启动时加载设置
 * - 独立存储：每个项目有独立的设置
 */
export const useSetting = create<SettingStore>((set, get) => ({
        // ============ 初始状态 ============
        data: {
        recent: [],
        buildDir: "",
        layout: "compact",
        projects: [],
        logLevel: LogLevel.INFO,
    },
        
    /**
     * 加载设置
     * 
     * 从 settings.json 文件读取设置
     * 
     * 处理：
     * - 如果文件不存在：使用默认设置
     * - 如果文件损坏：捕获错误并使用默认设置
     * - 向后兼容：为旧版本设置提供默认值
     * 
     * 调用时机：
     * - 应用启动时（setup.tsx）
     */
    load: async () => {
        try {
            const settingPath = await getSettingPath();
            if (fs.existsSync(settingPath)) {
                const settings = readJson(settingPath) as SettingModel;
                // 兼容旧版本：提供默认值
                settings.layout = settings.layout || "compact";
                settings.projects = settings.projects || [];
                settings.logLevel = settings.logLevel || LogLevel.INFO;
                set({ data: settings });
            }
        } catch (error) {
            console.error(error);
        }
    },
    
    /**
     * 保存设置
     * 
     * 将当前设置保存到 settings.json 文件
     * 
     * 注意：
     * - 每次修改后自动调用
     * - 同步写入文件
     */
    save: async () => {
        const settingPath = await getSettingPath();
        writeJson(settingPath, get().data);
    },
    
    /**
     * 添加到最近项目列表
     * 
     * @param path - 项目路径
     * 
     * 行为：
     * - 如果项目已存在：移到列表顶部
     * - 如果是新项目：添加到列表顶部
     * - 自动保存设置
     * 
     * 使用场景：
     * - 打开项目时
     * - 工作区初始化完成后
     */
    appendRecent: (path: string) => {
        const { data, save } = get();
        // 移除旧记录（如果存在）
        const recent = data.recent.filter((v) => v !== path);
        // 添加到列表顶部
        recent.unshift(path);
        set({ data: { ...data, recent } });
        save().catch(console.error);
    },
    
    /**
     * 从最近项目列表移除
     * 
     * @param path - 项目路径
     * 
     * 使用场景：
     * - 项目文件不存在时
     * - 用户手动从列表移除
     */
    removeRecent: (path: string) => {
        const { data, save } = get();
        const recent = data.recent.filter((v) => v !== path);
        set({ data: { ...data, recent } });
        save().catch(console.error);
    },
    
    /**
     * 设置节点布局
     * 
     * @param layout - 布局类型（compact: 紧凑 | normal: 正常）
     * 
     * 效果：
     * - compact：节点更小，信息更紧凑
     * - normal：节点更大，信息更清晰
     * 
     * 触发：
     * - 刷新当前编辑器视图
     * - 保存设置
     */
    setLayout: (layout: "compact" | "normal") => {
        const { data, save } = get();
        set({ data: { ...data, layout } });
        save().catch(console.error);
        // 刷新编辑器视图以应用新布局
        useWorkspace.getState().editing?.dispatch?.("refresh");
    },
    
    /**
     * 设置项目的构建目录
     * 
     * @param projectPath - 项目路径
     * @param dir - 构建目录路径
     * 
     * 行为：
     * - 如果项目设置不存在：创建新的项目设置
     * - 更新构建目录
     * - 保存设置
     */
    setBuildDir: (projectPath: string, dir: string) => {
        const { data, save } = get();
        let project = data.projects.find((v) => v.path === projectPath);
        if (!project) {
        project = {
            path: projectPath,
            buildDir: "",
            editors: [],
        };
        }
        project.buildDir = dir;
        set({ data: { ...data, projects: data.projects } });
        save().catch(console.error);
    },
    
    /**
     * 获取项目的构建目录
     * 
     * @param project - 项目路径
     * @returns 构建目录路径，如果未设置返回空字符串
     */
    getBuildDir: (project: string) => {
        const { data } = get();
        return data.projects.find((v) => v.path === project)?.buildDir ?? "";
    },
    
    /**
     * 记录打开的编辑器
     * 
     * @param projectPath - 项目路径
     * @param filePath - 文件路径
     * 
     * 行为：
     * - 如果项目设置不存在：创建新的项目设置
     * - 将所有其他编辑器设为非激活
     * - 如果编辑器已存在：设为激活
     * - 如果是新编辑器：添加并设为激活
     * - 保存设置
     * 
     * 用途：
     * - 恢复上次的工作会话
     * - 记住打开的标签页
     */
    openEditor: (projectPath: string, filePath: string) => {
        const { data, save } = get();
        let project = data.projects.find((v) => v.path === projectPath);
        if (!project) {
        project = {
            path: projectPath,
            buildDir: "",
            editors: [],
        };
        data.projects.push(project);
        }
        const editor = project.editors.find((v) => v.path === filePath);
        // 将所有编辑器设为非激活
        project.editors.forEach((v) => (v.active = false));
        if (editor) {
        // 编辑器已存在：设为激活
        editor.active = true;
        } else {
        // 新编辑器：添加并设为激活
        project.editors.push({ path: filePath, active: true });
        }
        set({ data: { ...data, projects: data.projects } });
        save().catch(console.error);
    },
    
    /**
     * 记录关闭的编辑器
     * 
     * @param project - 项目路径
     * @param path - 文件路径
     * 
     * 行为：
     * - 从编辑器列表中移除
     * - 保存设置
     * 
     * 用途：
     * - 清理已关闭的标签页
     * - 更新会话状态
     */
    closeEditor: (project: string, path: string) => {
        const { data, save } = get();
        const projectSetting = data.projects.find((v) => v.path === project);
        if (projectSetting) {
        projectSetting.editors = projectSetting.editors.filter((v) => v.path !== path);
        }
        set({ data: { ...data, projects: data.projects } });
        save().catch(console.error);
    },
    
    /**
     * 获取项目的所有打开的编辑器
     * 
     * @param project - 项目路径
     * @returns 打开的编辑器列表
     * 
     * 用途：
     * - 恢复上次打开的文件
     * - 初始化工作区时重新打开标签页
     */
    getEditors: (project: string) => {
    const { data } = get();
    return data.projects.find((p) => p.path === project)?.editors ?? [];
    },
    
    setLogLevel: (logLevel: LogLevel) => {
    const { data, save } = get();
    set({
        data: {
        ...data,
        logLevel,
        },
    });
    save().catch(console.error);
    },
    
    getLogLevel: () => {
    const { data } = get();
    return data.logLevel ?? LogLevel.INFO;
    },
}));
