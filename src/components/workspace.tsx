/**
 * Workspace 组件 - 应用主工作区
 * 
 * 这是整个应用的顶层布局组件，负责：
 * 1. 整体布局：标题栏 + 左侧文件树 + 中间编辑器区域 + 右侧属性面板
 * 2. 多标签页编辑器管理：支持同时打开多个行为树文件
 * 3. 全局快捷键处理：保存、撤销、重做、搜索等
 * 4. 文件变更检测：提示用户重新加载或保存
 * 5. 欢迎页面：未打开项目时显示快速开始界面
 * 
 * 架构设计：
 * - 使用 Ant Design 的 Layout 组件构建三栏布局
 * - Tabs 组件管理多个 Editor 实例
 * - Zustand 管理全局工作区状态
 * - React Hooks 处理副作用和键盘事件
 * 
 * 布局结构：
 * ```
 * ┌─────────────────────────────────────────────┐
 * │              TitleBar（标题栏）               │
 * ├──────────┬──────────────────────┬───────────┤
 * │          │                      │           │
 * │ Explorer │   Editor (Tabs)      │ Inspector │
 * │ (文件树)  │   (多标签编辑器)       │ (属性面板) │
 * │          │                      │           │
 * └──────────┴──────────────────────┴───────────┘
 * ```
 * 
 * 数据流：
 * 用户操作 → 快捷键/事件 → workspace状态更新 → 组件重渲染
 */

import { app } from "@electron/remote";
import { Button, Flex, Layout, Space, Tabs, Tag, Tooltip } from "antd";
import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaExclamationTriangle } from "react-icons/fa";
import { PiTreeStructureFill } from "react-icons/pi";
import { VscNewFolder, VscRepo } from "react-icons/vsc";
import useForceUpdate from "use-force-update";
import { useWindowSize } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import { useSetting } from "../contexts/setting-context";
import { EditEvent, EditorStore, useWorkspace } from "../contexts/workspace-context";
import { modal } from "../misc/hooks";
import { Hotkey, isMacos, setInputFocus, useKeyPress } from "../misc/keys";
import Path from "../misc/path";
import { Editor } from "./editor";
import { Explorer } from "./explorer";
import { Inspector } from "./inspector";
import { TitleBar } from "./titlebar";

const { Header, Content, Sider } = Layout;

/**
 * 快捷键到编辑事件的映射表
 * 
 * 将键盘快捷键映射到编辑器事件，用于节点操作
 * 
 * 映射关系：
 * - Ctrl/Cmd + C: 复制节点
 * - Ctrl/Cmd + V: 粘贴节点
 * - Ctrl/Cmd + R: 替换节点
 * - Enter: 插入节点
 * - Backspace/Delete: 删除节点
 * - Ctrl/Cmd + Z: 撤销
 * - Ctrl/Cmd + Shift + Z: 重做
 */
const hotkeyMap: Record<string, EditEvent> = {
    [Hotkey.Copy]: "copy",
    [Hotkey.Replace]: "replace",
    [Hotkey.Paste]: "paste",
    [Hotkey.Insert]: "insert",
    [Hotkey.Enter]: "insert",
    [Hotkey.Delete]: "delete",
    [Hotkey.Backspace]: "delete",
    [Hotkey.Undo]: "undo",
    [Hotkey.Redo]: "redo",
  };

/**
 * Workspace 主组件
 * 
 * 功能模块：
 * 1. 状态管理：订阅 workspace 和 settings 状态
 * 2. 快捷键处理：全局和编辑器级别的键盘快捷键
 * 3. 对话框管理：保存提示、重新加载提示
 * 4. 布局渲染：三栏布局 + 多标签页
 * 5. 欢迎页面：未打开项目时的引导界面
 */
export const Workspace: FC = () => {
  // ============ 状态订阅 ============
  
  /**
   * 订阅 workspace 状态
   * 
   * 使用 useShallow 优化性能，只在选中的属性变化时重新渲染
   * 
   * 订阅的状态：
   * - save: 保存当前文件
   * - editors: 所有打开的编辑器列表
   * - modifiedTime: 文件修改时间戳（用于触发重新加载提示）
   * - editing: 当前正在编辑的编辑器
   * - fileTree: 文件树数据
   * - 其他操作方法...
   */
  const workspace = useWorkspace(
    useShallow((state) => ({
      save: state.save,
      editors: state.editors,
      modifiedTime: state.modifiedTime,
      isShowingSearch: state.isShowingSearch,
      onShowingSearch: state.onShowingSearch,
      openProject: state.openProject,
      buildProject: state.buildProject,
      close: state.close,
      createProject: state.createProject,
      edit: state.edit,
      editing: state.editing,
      fileTree: state.fileTree,
      find: state.find,
    }))
  );
  
  /** 订阅应用设置（最近打开的项目等） */
  const { settings } = useSetting(useShallow((state) => ({ settings: state.data })));
  
  /** 是否正在显示对话框（防止重复显示） */
  const [isShowingAlert, setShowingAlert] = useState(false);
  
  /** 国际化翻译函数 */
  const { t } = useTranslation();
  
  /** 强制组件重新渲染的函数（用于 Editor 的 onChange） */
  const forceUpdate = useForceUpdate();
  
  /** 窗口尺寸（响应式布局） */
  const { width = 0, height = 0 } = useWindowSize();

  /** 键盘事件监听的 DOM 引用 */
  const keysRef = useRef<HTMLDivElement>(null);

  // ============ 全局快捷键 ============

  /**
   * Ctrl/Cmd + B: 构建项目
   * 
   * 将所有行为树导出到构建目录
   */
  useKeyPress(Hotkey.Build, keysRef, (event) => {
    event.preventDefault();
    workspace.buildProject();
  });

  /**
   * Ctrl/Cmd + S: 保存当前文件
   * 
   * 保存当前正在编辑的文件
   */
  useKeyPress(Hotkey.Save, keysRef, (event) => {
    event.preventDefault();
    workspace.save();
  });

  /**
   * Ctrl/Cmd + K: 关闭所有其他编辑器
   * 
   * 只保留当前正在编辑的文件，关闭其他所有标签页
   */
  useKeyPress(Hotkey.CloseAllOtherEditors, null, (event) => {
    event.preventDefault();
    workspace.editors.forEach((editor) => {
      if (editor.path !== workspace.editing?.path) {
        workspace.close(editor.path);
      }
    });
  });

  /**
   * Ctrl/Cmd + W: 关闭当前编辑器
   * 
   * 流程：
   * 1. 检查文件是否有未保存的修改
   * 2. 如果有修改：显示保存对话框
   * 3. 如果无修改：直接关闭
   */
  useKeyPress(Hotkey.CloseEditor, null, (event) => {
    event.preventDefault();
    if (workspace.editing) {
      if (workspace.editing.changed) {
        showSaveDialog(workspace.editing);
      } else {
        workspace.close(workspace.editing.path);
      }
    }
    keysRef.current?.focus();
  });

  /**
   * Ctrl/Cmd + P: 搜索文件
   * 
   * 打开文件搜索面板，快速定位和打开文件
   */
  useKeyPress(Hotkey.SearchTree, keysRef, (event) => {
    event.preventDefault();
    workspace.onShowingSearch(true);
  });

  /**
   * Ctrl/Cmd + F: 搜索节点
   * 
   * 在当前行为树中搜索节点（按内容搜索）
   */
  useKeyPress(Hotkey.SearchNode, keysRef, (event) => {
    event.preventDefault();
    workspace.editing?.dispatch?.("searchNode");
  });

  /**
   * Ctrl/Cmd + G: 跳转到节点
   * 
   * 按节点 ID 快速跳转
   */
  useKeyPress(Hotkey.JumpNode, keysRef, (event) => {
    event.preventDefault();
    workspace.editing?.dispatch?.("jumpNode");
  });

  /**
   * 自动聚焦到工作区
   * 
   * 当搜索面板关闭且无对话框时，自动聚焦到工作区
   * 这样快捷键可以正常工作
   */
  useEffect(() => {
    if (!workspace.isShowingSearch && !isShowingAlert) {
      keysRef.current?.focus();
    }
  }, [workspace.isShowingSearch]);

  /**
   * 节点编辑快捷键
   * 
   * 处理节点的复制、粘贴、删除等操作
   * 
   * 注意：
   * - 只在非输入框元素时生效
   * - 阻止事件冒泡和默认行为
   * - 通过 hotkeyMap 映射到编辑器事件
   */
  useKeyPress(
    [
      Hotkey.Copy,
      Hotkey.Replace,
      Hotkey.Paste,
      Hotkey.Insert,
      Hotkey.Enter,
      Hotkey.Delete,
      Hotkey.Backspace,
    ],
    keysRef,
    (e, key) => {
      // 输入框内不处理这些快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      // 分发到当前编辑器
      workspace.editing?.dispatch?.(hotkeyMap[key]);
    }
  );

  /**
   * 撤销/重做快捷键
   * 
   * Ctrl/Cmd + Z: 撤销
   * Ctrl/Cmd + Shift + Z: 重做
   * 
   * 注意：不阻止默认行为，以便输入框的撤销/重做仍然工作
   */
  useKeyPress([Hotkey.Undo, Hotkey.Redo], null, (e, key) => {
    // 输入框内使用原生撤销/重做
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    e.stopPropagation();
    workspace.editing?.dispatch?.(hotkeyMap[key]);
  });

  // ============ 文件变更检测 ============

  /**
   * 监听文件外部修改
   * 
   * 当文件在外部被修改时（如其他编辑器、脚本等），提示用户重新加载
   * 
   * 工作流程：
   * 1. 文件系统监听器检测到文件变化
   * 2. workspace-context 设置 editor.alertReload = true
   * 3. 这里的 useEffect 检测到 alertReload
   * 4. 显示重新加载确认对话框
   * 
   * 用户选项：
   * - 重新加载：放弃当前修改，从磁盘重新加载
   * - 取消：保持当前内容，继续编辑
   * 
   * 依赖：
   * - workspace.editing: 当前编辑器
   * - workspace.modifiedTime: 修改时间戳（触发检查）
   */
  useEffect(() => {
    const editor = workspace.editing;
    
    // 检查是否需要提示重新加载
    if (editor?.alertReload) {
      // 防止重复显示对话框
      if (isShowingAlert) {
        return;
      }
      
      setShowingAlert(true);
      const alert = modal.confirm({
        centered: true,
        content: (
          <Flex vertical gap="middle">
            <div>
              <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
            </div>
            <div>{t("workspace.reloadFile", { name: Path.basename(editor.path) })}</div>
          </Flex>
        ),
        footer: (
          <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
            <Flex vertical gap="6px">
              <Button
                type="primary"
                onClick={() => {
                  editor.alertReload = false;
                  editor.dispatch?.("reload");  // 重新加载文件
                  alert.destroy();
                  keysRef.current?.focus();
                  setShowingAlert(false);
                }}
              >
                {t("reload")}
              </Button>
              <Button
                onClick={() => {
                  editor.alertReload = false;
                  alert.destroy();
                  keysRef.current?.focus();
                  setShowingAlert(false);
                }}
              >
                {t("cancel")}
              </Button>
            </Flex>
          </Flex>
        ),
      });
    }
  }, [workspace.editing, workspace.modifiedTime]);

  // ============ 对话框函数 ============

  /**
   * 显示保存确认对话框
   * 
   * @param editor 要关闭的编辑器
   * 
   * 场景：
   * - 用户关闭有未保存修改的文件
   * - 用户关闭窗口时有未保存的文件
   * 
   * 用户选项：
   * 1. 保存：保存文件后关闭
   * 2. 不保存：直接关闭，丢弃修改
   * 3. 取消：取消关闭操作
   * 
   * 注意：使用 isShowingAlert 防止重复显示对话框
   */
  const showSaveDialog = (editor: EditorStore) => {
    if (isShowingAlert) {
      return;
    }
    
    setShowingAlert(true);
    const alert = modal.confirm({
      centered: true,
      content: (
        <Flex vertical gap="middle">
          <div>
            <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
          </div>
          <div>{t("workspace.saveOnClose", { name: Path.basename(editor.path) })}</div>
        </Flex>
      ),
      footer: (
        <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
          <Flex vertical gap="6px">
            <Button
              type="primary"
              onClick={() => {
                editor.dispatch?.("save");       // 保存
                workspace.close(editor.path);    // 关闭
                alert.destroy();
                keysRef.current?.focus();
                setShowingAlert(false);
              }}
            >
              {t("save")}
            </Button>
            <Button
              danger
              onClick={() => {
                workspace.close(editor.path);    // 直接关闭，不保存
                alert.destroy();
                keysRef.current?.focus();
                setShowingAlert(false);
              }}
            >
              {t("donotSave")}
            </Button>
          </Flex>
          <Button
            onClick={() => {
              alert.destroy();                   // 取消关闭
              keysRef.current?.focus();
              setShowingAlert(false);
            }}
          >
            {t("cancel")}
          </Button>
        </Flex>
      ),
    });
  };

  /**
   * 显示批量保存确认对话框
   * 
   * @param unsaves 有未保存修改的编辑器列表
   * 
   * 场景：
   * - 用户关闭窗口时有多个未保存的文件
   * 
   * 用户选项：
   * 1. 全部保存：保存所有文件后关闭窗口
   * 2. 全部不保存：直接关闭窗口，丢弃所有修改
   * 3. 取消：取消关闭窗口
   * 
   * UI：
   * - 单个文件：显示文件名
   * - 多个文件：显示文件数量和文件列表
   */
  const showSaveAllDialog = (unsaves: EditorStore[]) => {
    if (isShowingAlert) {
      return;
    }
    
    setShowingAlert(true);
    const alert = modal.confirm({
      centered: true,
      content: (
        <Flex vertical gap="middle">
          <div>
            <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
          </div>
          {/* 单个文件 */}
          {unsaves.length === 1 && (
            <div>{t("workspace.saveOnClose", { name: Path.basename(unsaves[0].path) })}</div>
          )}
          {/* 多个文件 */}
          {unsaves.length > 1 && (
            <>
              <div>{t("workspace.saveAllOnClose", { count: unsaves.length })}</div>
              <Flex vertical style={{ fontSize: "12px" }}>
                {unsaves.map((editor) => (
                  <div key={editor.path}>{Path.basename(editor.path)}</div>
                ))}
              </Flex>
            </>
          )}
        </Flex>
      ),
      footer: (
        <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
          <Flex vertical gap="6px">
            <Button
              type="primary"
              onClick={() => {
                // 保存所有文件
                unsaves.forEach((editor) => editor.dispatch?.("save"));
                alert.destroy();
                window.close();
                setShowingAlert(false);
              }}
            >
              {unsaves.length > 1 ? t("saveAll") : t("save")}
            </Button>
            <Button
              danger
              onClick={() => {
                // 清空编辑器列表，直接关闭
                workspace.editors.length = 0;
                alert.destroy();
                window.close();
                setShowingAlert(false);
              }}
            >
              {t("donotSave")}
            </Button>
          </Flex>
          <Button
            onClick={() => {
              alert.destroy();
              setShowingAlert(false);
            }}
          >
            {t("cancel")}
          </Button>
        </Flex>
      ),
    });
  };

  /**
   * 窗口关闭前的处理
   * 
   * 监听 window.onbeforeunload 事件
   * 
   * 流程：
   * 1. 检查是否有未保存的文件
   * 2. 如果有：显示保存确认对话框，阻止关闭
   * 3. 如果无：允许关闭
   * 
   * 注意：
   * - 返回 false 会阻止窗口关闭
   * - 对话框中用户选择后会手动调用 window.close()
   */
  window.onbeforeunload = (e) => {
    const unsaves = workspace.editors.filter((editor) => editor.changed);
    if (unsaves.length) {
      showSaveAllDialog(unsaves);
      return false;  // 阻止关闭
    }
  };

  // ============ 渲染 ============

  return (
    <Layout
      className="b3-workspace"
      tabIndex={-1}
      ref={keysRef}
      style={{ width: width, height: height }}
    >
      {/* ========== 标题栏 ========== */}
      <Header
        style={{
          padding: "0px",
          height: "fit-content",
          borderBottom: `1px solid var(--b3-color-border)`,
        }}
      >
        <TitleBar />
      </Header>
      
      {/* ========== 主布局区域（三栏） ========== */}
      <Layout
        hasSider
        style={{ overflow: "hidden" }}
        onFocus={(e) => {
          setInputFocus(e.target);
        }}
      >
        {/* ========== 左侧文件树 ========== */}
        {workspace.fileTree && (
          <Sider
            width={300}
            style={{
              height: "100%",
              borderRight: `1px solid var(--b3-color-border)`,
            }}
          >
            <Explorer />
          </Sider>
        )}
        
        {/* ========== 中间编辑器区域 ========== */}
        <Content>
          {/* ========== 欢迎页面（未打开项目） ========== */}
          {!workspace.fileTree && (
            <Flex vertical align="center" style={{ height: "100%" }}>
              <Flex
                vertical
                style={{
                  fontSize: "15px",
                  width: "fit-content",
                  height: "100%",
                  paddingTop: "50px",
                  paddingBottom: "50px",
                }}
              >
                {/* Logo 和标题 */}
                <Flex
                  align="center"
                  gap="5px"
                  style={{ fontSize: "40px", fontWeight: "600", marginBottom: "10px" }}
                >
                  <PiTreeStructureFill size="50px" />
                  <div>Behavior3 Editor</div>
                </Flex>
                
                {/* 快速开始区域 */}
                <Flex vertical style={{ paddingLeft: "55px", paddingBottom: "15px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "500" }}>{t("start")}</div>
                  
                  {/* 创建新项目 */}
                  <Flex
                    align="center"
                    gap="5px"
                    style={{
                      width: "fit-content",
                      fontWeight: "500",
                      cursor: "pointer",
                      color: "var(--ant-color-primary)",
                    }}
                    onClick={() => workspace.createProject()}
                  >
                    <VscNewFolder size="20px" />
                    {t("createProject")}
                  </Flex>
                  
                  {/* 打开已有项目 */}
                  <Flex
                    align="center"
                    gap="5px"
                    style={{
                      fontWeight: "500",
                      width: "fit-content",
                      cursor: "pointer",
                      color: "var(--ant-color-primary)",
                    }}
                    onClick={() => workspace.openProject()}
                  >
                    <VscRepo size="19px" />
                    {t("openProject")}
                  </Flex>
                </Flex>
                
                {/* 最近打开的项目 */}
                <Flex vertical style={{ paddingLeft: "55px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "500" }}>{t("recent")}</div>
                  <div style={{ overflow: "auto", height: "100%" }}>
                    {settings.recent.map((path) => {
                      const homedir = app.getPath("home");
                      return (
                        <div key={path}>
                          <span
                            onClick={() => workspace.openProject(path)}
                            style={{
                              color: "var(--ant-color-primary)",
                              fontWeight: "500",
                              cursor: "pointer",
                              marginRight: "15px",
                            }}
                          >
                            {Path.basename(path)}
                          </span>
                          <span>{Path.dirname(path).replace(homedir, "~")}</span>
                        </div>
                      );
                    })}
                  </div>
                </Flex>
              </Flex>
            </Flex>
          )}
          
          {/* ========== 快捷键提示（已打开项目但无编辑器） ========== */}
          {workspace.editors.length === 0 && (
            <Flex vertical align="center" justify="center" style={{ height: "100%" }}>
              <Flex
                vertical
                gap="10px"
                style={{
                  color: "gray",
                  fontSize: "15px",
                  width: "fit-content",
                  paddingTop: "50px",
                  marginRight: "150px",
                  paddingBottom: "50px",
                }}
              >
                {/* 常用快捷键列表 */}
                {[
                  { label: t("searchFile"), hotkeys: isMacos ? "⌘ P" : "Ctrl + P" },
                  { label: t("build"), hotkeys: isMacos ? "⌘ B" : "Ctrl + B" },
                  { label: t("searchNode"), hotkeys: isMacos ? "⌘ F" : "Ctrl + F" },
                  { label: t("insertNode"), hotkeys: "Enter" },
                  { label: t("deleteNode"), hotkeys: "Backspace" },
                ].map((v) => (
                  <Flex
                    key={v.label}
                    gap="20px"
                    style={{
                      minWidth: "200px",
                    }}
                  >
                    <span style={{ width: "150px", textAlign: "end" }}>{v.label}</span>
                    <Space size={5}>
                      {v.hotkeys.split(" ").map((key, index) => (
                        <div key={index}>
                          {key === "+" && <div>+</div>}
                          {key !== "+" && (
                            <Tag style={{ color: "gray", fontSize: "14px", marginRight: 0 }}>
                              {key}
                            </Tag>
                          )}
                        </div>
                      ))}
                    </Space>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          )}
          
          {/* ========== 多标签页编辑器 ========== */}
          {workspace.editors.length > 0 && (
            <Tabs
              hideAdd                                     // 隐藏添加按钮（通过文件树打开文件）
              type="editable-card"                        // 可编辑卡片样式（有关闭按钮）
              activeKey={workspace.editing?.path}         // 当前活动标签页（关键：响应状态变化）
              
              /**
               * 标签页编辑事件
               * 
               * action 可能的值：
               * - "add": 添加标签页（已禁用）
               * - "remove": 移除标签页（点击关闭按钮）
               * 
               * 流程：
               * 1. 检查文件是否有未保存的修改
               * 2. 如果有：显示保存对话框
               * 3. 如果无：直接关闭
               */
              onEdit={(activeKey, action) => {
                if (action === "remove") {
                  const path = activeKey as string;
                  const editor = workspace.find(path);
                  if (editor && editor.changed) {
                    showSaveDialog(editor);
                  } else {
                    workspace.close(path);
                    keysRef.current?.focus();
                  }
                }
              }}
              
              /**
               * 标签页切换事件
               * 
               * @param activeKey 新的活动标签页的 key（文件路径）
               * 
               * 流程：
               * 1. 调用 workspace.edit(activeKey)
               * 2. 更新 workspace.editing 状态
               * 3. Editor 组件的 useEffect 检测到变化
               * 4. 刷新 Graph 实例
               * 5. 显示对应的行为树
               * 
               * 这是切换编辑器的关键入口之一：
               * - Explorer点击文件 → workspace.open() → workspace.edit()
               * - 用户点击标签页 → onChange → workspace.edit()
               */
              onChange={(activeKey) => {
                workspace.edit(activeKey);
              }}
              
              /**
               * 标签页列表
               * 
               * 遍历所有打开的编辑器，为每个编辑器创建一个标签页
               * 
               * 关键点：
               * - key: 文件路径（唯一标识）
               * - label: 文件名 + 修改标记（*）
               * - children: Editor 组件实例
               * 
               * 注意：
               * - 所有 Editor 组件实例同时存在于 DOM 中
               * - Tabs 通过 display:none 隐藏非活动标签页
               * - 切换标签页不会重新创建 Editor 实例
               * - 这样可以保持 Graph 的状态（如缩放、位置等）
               */
              items={workspace.editors.map((v) => {
                return {
                  label: (
                    <Tooltip
                      arrow={false}
                      placement="bottom"
                      mouseEnterDelay={1}
                      color="#010409"
                      overlayStyle={{ userSelect: "none", WebkitUserSelect: "none" }}
                      autoAdjustOverflow={true}
                      overlayInnerStyle={{
                        width: "fit-content",
                        border: "1px solid var(--b3-color-border)",
                        borderRadius: "4px",
                      }}
                      title={<div style={{ width: "max-content" }}>{v.path}</div>}
                    >
                      {/* 文件名 + 修改标记 */}
                      {`${Path.basename(v.path)}${v.changed ? "*" : ""}`}
                    </Tooltip>
                  ),
                  key: v.path,
                  
                  /**
                   * 每个标签页的内容：Editor 组件
                   * 
                   * data: EditorStore 实例（包含文件数据和状态）
                   * onChange: 强制重新渲染（当文件修改状态变化时）
                   * 
                   * Editor 组件内部：
                   * 1. 创建 Graph 实例
                   * 2. 渲染行为树到画布
                   * 3. 处理节点操作
                   * 4. 响应 workspace.editing 变化
                   */
                  children: <Editor data={v} onChange={forceUpdate} />,
                };
              })}
            />
          )}
        </Content>
        
        {/* ========== 右侧属性面板 ========== */}
        <Inspector />
      </Layout>
    </Layout>
  );
};
