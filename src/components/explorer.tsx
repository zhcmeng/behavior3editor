/**
 * Explorer 组件 - 文件资源管理器
 * 
 * 这是编辑器的左侧边栏组件，主要功能：
 * 1. 显示工作区的文件树结构（行为树.json文件和文件夹）
 * 2. 显示可用的节点定义树（从 node-config.b3-setting 加载）
 * 3. 处理文件/文件夹的增删改查操作
 * 4. 支持拖拽操作（文件移动、节点拖拽到画布）
 * 5. 提供右键上下文菜单
 * 
 * 架构设计：
 * - 使用 Ant Design 的 DirectoryTree 组件
 * - 两个独立的树：文件树 + 节点定义树
 * - 响应式状态管理（Zustand + React Hooks）
 * - 键盘快捷键支持
 * 
 * 数据流：
 * 用户操作 → dispatch事件 → workspace操作 → 文件系统 → 刷新UI
 */

import { DownOutlined } from "@ant-design/icons";
import { Button, Dropdown, Flex, FlexProps, Input, MenuProps, Space, Tree } from "antd";
import { ItemType } from "antd/es/menu/interface";
import { ipcRenderer } from "electron";
import * as fs from "fs";
import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsBoxFill } from "react-icons/bs";
import { FaExclamationTriangle, FaSwatchbook } from "react-icons/fa";
import { FiCommand, FiDelete } from "react-icons/fi";
import { IoMdReturnLeft } from "react-icons/io";
import { PiTreeStructureFill } from "react-icons/pi";
import { useShallow } from "zustand/react/shallow";
import { FileTreeType, useWorkspace } from "../contexts/workspace-context";
import { getNodeType, NodeDef } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { modal } from "../misc/hooks";
import i18n from "../misc/i18n";
import { Hotkey, isMacos, useKeyPress } from "../misc/keys";
import Path from "../misc/path";

const { DirectoryTree } = Tree;

/**
 * 防抖定时器
 * 用于滚动到视图时的延迟处理
 */
let timeout: NodeJS.Timeout;

/**
 * 菜单事件类型
 * 定义了所有支持的文件/文件夹操作
 */
type MenuInfo = Parameters<Exclude<MenuProps["onClick"], undefined>>[0];
type MenuEvent =
  | "open"           // 打开文件
  | "newFile"        // 新建文件
  | "newFolder"      // 新建文件夹
  | "revealFile"     // 在文件管理器中显示
  | "rename"         // 重命名
  | "delete"         // 删除
  | "paste"          // 粘贴
  | "copy"           // 复制
  | "move"           // 移动（拖拽）
  | "duplicate";     // 复制文件

/**
 * 节点定义树节点类型
 * 用于展示可用的行为树节点（从 behavior3 库或自定义节点）
 */
export type NodeTreeType = {
  title: string;               // 显示标题
  path: string;                // 唯一路径标识
  def?: NodeDef;               // 节点定义（叶子节点才有）
  icon?: React.ReactNode;      // 图标
  isLeaf?: boolean;            // 是否为叶子节点
  children?: NodeTreeType[];   // 子节点
  style?: React.CSSProperties; // 自定义样式
};

/**
 * 在文件树中查找指定路径的节点
 * 
 * @param path 要查找的文件路径
 * @param node 当前搜索的节点
 * @returns 找到的节点，未找到返回 undefined
 * 
 * 算法：深度优先搜索（DFS）
 */
const findFile = (path: string | undefined, node: FileTreeType): FileTreeType | undefined => {
  if (!path) {
    return;
  } else if (node.path === path) {
    return node;
  }
  // 递归搜索子节点
  if (node.children) {
    for (const child of node.children) {
      const ret = findFile(path, child);
      if (ret) {
        return ret;
      }
    }
  }
};

/**
 * 查找指定节点的父节点
 * 
 * @param node 要查找父节点的节点
 * @param parent 当前搜索的父节点
 * @returns 找到的父节点，未找到返回 undefined
 * 
 * 用途：删除节点、移动节点时需要找到父节点
 */
const findParent = (node: FileTreeType, parent?: FileTreeType): FileTreeType | undefined => {
  if (parent && parent.children) {
    // 检查当前父节点是否包含目标节点
    if (parent.children?.indexOf(node) >= 0) {
      return parent;
    }
    // 递归搜索子节点
    for (const child of parent.children) {
      const v = findParent(node, child);
      if (v) {
        return v;
      }
    }
  }
};

/**
 * 解析到达指定路径所需展开的所有父节点路径
 * 
 * @param path 目标路径
 * @param node 当前搜索的节点
 * @param keys 累积的展开键列表
 * @returns 是否找到目标路径
 * 
 * 用途：自动展开文件树以显示指定文件
 * 
 * 算法：
 * 1. 如果当前节点是目标，返回 true
 * 2. 如果有子节点，将当前节点加入 keys 并递归搜索
 * 3. 如果子节点中找到目标，保留当前 key；否则移除
 */
const resolveKeys = (path: string, node: FileTreeType | NodeTreeType, keys: React.Key[]) => {
  if (node.path === path) {
    return true;
  }
  if (node.children) {
    keys.push(node.path);
    for (const child of node.children) {
      if (resolveKeys(path, child, keys)) {
        return true;
      }
    }
    keys.pop();
  }
  return false;
};

/**
 * 重命名文件或文件夹
 * 
 * @param oldPath 旧路径
 * @param newPath 新路径
 * @returns 是否重命名成功
 * 
 * 处理流程：
 * 1. 检查新路径是否已存在
 * 2. 执行文件系统重命名
 * 3. 更新所有打开的编辑器的路径
 * 4. 分别处理文件和文件夹的情况
 * 
 * 注意：
 * - 如果是文件夹，需要更新所有子文件的编辑器路径
 * - 如果是文件，只需要更新该文件的编辑器路径
 */
const renameFile = (oldPath: string, newPath: string) => {
  const workspace = useWorkspace.getState();

  // 检查目标路径是否已存在
  if (fs.existsSync(newPath)) {
    return false;
  } else if (oldPath !== newPath) {
    try {
      // 执行文件系统重命名
      fs.renameSync(oldPath, newPath);
      const isDirectory = fs.statSync(newPath).isDirectory();

      // 更新所有打开的编辑器
      for (const editor of workspace.editors) {
        if (isDirectory) {
          // 文件夹：更新所有子文件路径
          if (editor.path.startsWith(oldPath)) {
            editor.dispatch?.("rename", editor.path.replace(oldPath, newPath));
          }
        } else {
          // 文件：只更新匹配的文件
          if (editor.path === oldPath) {
            editor.dispatch?.("rename", newPath);
          }
        }
      }
      return true;
    } catch (e) {
      console.error(e);
    }
  }
  return false;
};

/**
 * 创建文件的右键上下文菜单
 * 
 * @param node 文件节点
 * @returns 菜单项数组
 * 
 * 菜单选项：
 * - 打开：打开行为树文件进行编辑
 * - 复制：将文件路径复制到剪贴板
 * - 复制文件：创建文件的副本
 * - 在文件管理器中显示：打开系统文件管理器
 * - 重命名：重命名文件
 * - 删除：将文件移动到回收站
 */
const createFileContextMenu = (node: FileTreeType) => {
  const isTreeFile = b3util.isTreeFile(node.path);

  // 菜单项组件（统一样式）
  const MenuItem: FC<FlexProps> = (itemProps) => {
    return (
      <Flex
        gap="50px"
        style={{ minWidth: "200px", justifyContent: "space-between", alignItems: "center" }}
        {...itemProps}
      ></Flex>
    );
  };

  const arr: MenuProps["items"] = [
    {
      disabled: !isTreeFile,
      label: (
        <MenuItem>
          <div>{i18n.t("open")}</div>
        </MenuItem>
      ),
      key: "open",
    },
    {
      disabled: !isTreeFile,
      label: (
        <MenuItem>
          <div>{i18n.t("copy")}</div>
          <div>{isMacos ? "⌘ C" : "Ctrl+C"}</div>
        </MenuItem>
      ),
      key: "copy",
    },
    {
      disabled: !isTreeFile,
      label: (
        <MenuItem>
          <div>{i18n.t("duplicate")}</div>
          <div>{isMacos ? "⌘ D" : "Ctrl+D"}</div>
        </MenuItem>
      ),
      key: "duplicate",
    },
    {
      label: (
        <MenuItem>
          <div>{isMacos ? i18n.t("revealFileOnMac") : i18n.t("revealFileOnWindows")}</div>
        </MenuItem>
      ),
      key: "revealFile",
    },
    {
      label: (
        <MenuItem>
          <div>{i18n.t("rename")}</div>
          {isMacos && <IoMdReturnLeft />}
          {!isMacos && <div>F2</div>}
        </MenuItem>
      ),
      key: "rename",
    },
    {
      label: (
        <MenuItem>
          <div>{i18n.t("delete")}</div>
          {isMacos && (
            <Space size={6}>
              <FiCommand />
              <FiDelete />
            </Space>
          )}
        </MenuItem>
      ),
      key: "delete",
    },
  ];
  return arr;
};

/**
 * 创建文件夹的右键上下文菜单
 * 
 * @param copiedPath 剪贴板中的文件路径（用于判断粘贴按钮是否可用）
 * @returns 菜单项数组
 * 
 * 菜单选项：
 * - 新建文件：在当前文件夹创建新的行为树文件
 * - 新建文件夹：在当前文件夹创建子文件夹
 * - 在文件管理器中显示
 * - 粘贴：粘贴剪贴板中的文件
 * - 重命名
 * - 删除
 */
const createFolderContextMenu = (copiedPath: string) => {
  const MenuItem: FC<FlexProps> = (itemProps) => {
    return (
      <Flex
        gap="50px"
        style={{ minWidth: "200px", justifyContent: "space-between", alignItems: "center" }}
        {...itemProps}
      ></Flex>
    );
  };

  const arr: MenuProps["items"] = [
    {
      label: (
        <MenuItem>
          <div>{i18n.t("newFile")}</div>
        </MenuItem>
      ),
      key: "newFile",
    },
    {
      label: (
        <MenuItem>
          <div>{i18n.t("newFolder")}</div>
        </MenuItem>
      ),
      key: "newFolder",
    },
    {
      label: (
        <MenuItem>
          <div>{isMacos ? i18n.t("revealFileOnMac") : i18n.t("revealFileOnWindows")}</div>
        </MenuItem>
      ),
      key: "revealFile",
    },
    {
      disabled: !copiedPath,
      label: (
        <MenuItem>
          <div>{i18n.t("paste")}</div>
          <div>{isMacos ? "⌘ V" : "Ctrl+V"}</div>
        </MenuItem>
      ),
      key: "paste",
    },
    {
      label: (
        <MenuItem>
          <div>{i18n.t("rename")}</div>
          {isMacos && <IoMdReturnLeft />}
          {!isMacos && <div>F2</div>}
        </MenuItem>
      ),
      key: "rename",
    },
    {
      label: (
        <MenuItem>
          <div>{i18n.t("delete")}</div>
          {isMacos && (
            <Space size={6}>
              <FiCommand />
              <FiDelete />
            </Space>
          )}
        </MenuItem>
      ),
      key: "delete",
    },
  ];
  return arr;
};

/**
 * 从文件树中提取指定目录的内容
 * 
 * @param fileTree 文件树根节点
 * @param dirName 目录名称（如 "cfgs" 或 "vars"）
 * @returns 目录下的文件列表，如果目录不存在则返回空数组
 */
const extractDirectoryFiles = (fileTree: FileTreeType | undefined, dirName: string): FileTreeType[] => {
  if (!fileTree || !fileTree.children) {
    return [];
  }

  // 查找指定目录
  const targetDir = fileTree.children.find(child =>
    !child.isLeaf && Path.basename(child.path) === dirName
  );

  if (!targetDir || !targetDir.children) {
    return [];
  }

  // 返回目录下的所有文件（递归展开子目录）
  const collectFiles = (node: FileTreeType): FileTreeType[] => {
    if (node.isLeaf) {
      return [node];
    }

    if (node.children) {
      return node.children.flatMap(child => collectFiles(child));
    }

    return [];
  };

  return targetDir.children.flatMap(child => collectFiles(child));
};

/**
 * 创建分类树节点
 * 
 * @param title 分类标题
 * @param path 唯一路径标识
 * @param files 文件列表
 * @param icon 图标
 * @returns 分类树节点
 */
const createCategoryTree = (
  title: string,
  path: string,
  files: FileTreeType[],
  icon: React.ReactNode
): NodeTreeType => {
  return {
    title,
    path,
    icon,
    children: files.map(file => ({
      title: Path.basename(file.title),
      path: file.path,
      isLeaf: true,
      icon: <Flex justify="center" align="center" style={{ height: "100%" }}>
        <BsBoxFill />
      </Flex>
    }))
  };
};

/**
 * 过滤文件树，移除指定的目录
 * 
 * @param fileTree 原始文件树
 * @param excludeDirs 要排除的目录名称列表
 * @returns 过滤后的文件树
 */
const filterFileTree = (fileTree: FileTreeType | undefined, excludeDirs: string[]): FileTreeType | undefined => {
  if (!fileTree) {
    return undefined;
  }

  // 如果是叶子节点，直接返回
  if (fileTree.isLeaf) {
    return fileTree;
  }

  // 过滤子节点
  const filteredChildren = fileTree.children
    ?.filter(child => {
      // 如果是文件夹，检查是否在排除列表中
      if (!child.isLeaf) {
        const dirName = Path.basename(child.path);
        return !excludeDirs.includes(dirName);
      }
      return true;
    })
    ?.map(child => filterFileTree(child, excludeDirs))
    ?.filter(child => child !== undefined) as FileTreeType[];

  return {
    ...fileTree,
    children: filteredChildren
  };
};

/**
 * 创建节点定义树
 * 
 * @param rootName 根节点名称
 * @param nodeDefs 所有节点定义
 * @returns 节点定义树数据结构
 * 
 * 功能：
 * 1. 将所有节点定义按类型和分组组织成树形结构
 * 2. 支持拖拽到画布创建节点
 * 3. 支持自定义图标
 * 
 * 树结构：
 * ```
 * 节点定义
 * ├─ Action
 * │  ├─ Wait(等待)
 * │  └─ Log(日志)
 * ├─ Composite
 * │  ├─ Sequence(顺序)
 * │  └─ Selector(选择)
 * └─ ...
 * ```
 * 
 * 分组结构（如果有 group）：
 * ```
 * 节点定义
 * ├─ Action (Hero)
 * │  └─ Attack(攻击)
 * ├─ Action (Monster)
 * │  └─ Patrol(巡逻)
 * └─ ...
 * ```
 */
const createNodeTree = (rootName: string, nodeDefs: b3util.NodeDefs) => {
  const workspace = useWorkspace.getState();

  // 创建根节点
  const data: NodeTreeType = {
    title: i18n.t("nodeDefinition"),
    path: rootName,
    icon: (
      <Flex justify="center" align="center" style={{ height: "100%" }}>
        <PiTreeStructureFill size={19} />
      </Flex>
    ),
    children: [],
    style: {
      fontWeight: "bold",
      fontSize: "13px",
    },
  };

  // 遍历所有节点定义
  nodeDefs.forEach((nodeDef) => {
    // 处理分组（一个节点可能属于多个分组）
    (nodeDef.group || [""]).forEach((g) => {
      // 类型分组名称：如 "Action" 或 "Action (Hero)"
      const typeGroup = !g ? nodeDef.type : `${nodeDef.type} (${g})`;

      // 查找或创建类型分组节点
      let catalog = data.children?.find((nt) => nt.title === typeGroup);
      if (!catalog) {
        const type = getNodeType(nodeDef);
        catalog = {
          title: typeGroup,
          path: `nodeTree.catalog.${typeGroup}`,
          children: [],
          icon: (
            <Flex justify="center" align="center" style={{ height: "100%" }}>
              <img
                className="b3-node-icon"
                style={{ width: "13px", height: "13px", color: "white" }}
                src={`./icons/${type}.svg`}
              />
            </Flex>
          ),
        };
        data.children?.push(catalog);
      }

      // 添加节点到分组
      catalog.children?.push({
        title: `${nodeDef.name}(${nodeDef.desc})`,
        isLeaf: true,
        def: nodeDef,
        path: `${nodeDef.name}(${g})`,
        icon: (
          <Flex justify="center" align="center" style={{ height: "100%" }}>
            {nodeDef.icon ? (
              <img
                className="b3-node-icon"
                style={{ width: "13px", height: "13px", color: "white" }}
                src={`file:///${workspace.workdir}/${nodeDef.icon}`}
              />
            ) : (
              <BsBoxFill style={{ width: "12px", height: "12px", color: "white" }} />
            )}
          </Flex>
        ),
      });
    });
  });

  // 排序：分组按字母顺序，分组内节点也按字母顺序
  data.children?.sort((a, b) => a.title.localeCompare(b.title));
  data.children?.forEach((child) => child.children?.sort((a, b) => a.title.localeCompare(b.title)));

  return data;
};

/**
 * 检查元素是否在容器的可视区域内
 * 
 * @param element 要检查的元素
 * @param container 容器元素
 * @returns 元素是否在可视区域内
 * 
 * 用途：决定是否需要滚动到视图
 */
const isElementInViewport = (element: Element, container: Element) => {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
};

/**
 * 滚动到指定路径的节点
 * 
 * @param path 节点路径
 * 
 * 功能：
 * 1. 防抖处理（300ms）
 * 2. 查找对应的 DOM 元素
 * 3. 检查是否在可视区域
 * 4. 不在可视区域则滚动到中心位置
 * 
 * 使用场景：
 * - 打开文件时自动定位
 * - 搜索节点后定位
 * - 切换编辑器时定位
 */
const scrollIntoView = (path: string) => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    const element = document.querySelector(`[title="${path}"]`);
    const container = element?.closest(".b3-overflow") || element?.closest(".b3-explorer");
    if (element && container && !isElementInViewport(element, container)) {
      element.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    }
  }, 300);
};

/**
 * 显示替换文件确认对话框
 * 
 * @param path 原文件路径
 * @param newPath 新文件路径
 * 
 * 场景：
 * - 粘贴文件时目标路径已存在
 * - 移动文件时目标路径已存在
 * 
 * 用户选项：
 * - 替换：关闭目标文件编辑器并替换文件
 * - 取消：放弃操作
 */
const alertReplaceFile = (path: string, newPath: string) => {
  const workspace = useWorkspace.getState();
  const alert = modal.confirm({
    centered: true,
    content: (
      <Flex vertical gap="middle">
        <div>
          <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
        </div>
        <div>{i18n.t("explorer.replaceFile", { name: Path.basename(newPath) })}</div>
      </Flex>
    ),
    footer: (
      <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
        <Flex vertical gap="6px">
          <Button
            danger
            onClick={() => {
              workspace.close(newPath);
              renameFile(path, newPath);
              alert.destroy();
            }}
          >
            {i18n.t("replace")}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              alert.destroy();
            }}
          >
            {i18n.t("cancel")}
          </Button>
        </Flex>
      </Flex>
    ),
  });
};

/**
 * 执行文件移动操作
 * 
 * @param path 源文件路径
 * @param newPath 目标文件路径
 * 
 * 功能：
 * 1. 检查目标路径是否已存在
 * 2. 执行文件系统移动
 * 3. 更新所有受影响的编辑器路径
 * 4. 刷新编辑器视图
 * 
 * 处理：
 * - 如果目标存在：显示替换确认对话框
 * - 如果移动文件夹：更新所有子文件的编辑器
 * - 移动后刷新目标位置的编辑器
 */
const doMoveFile = (path: string, newPath: string) => {
  const workspace = useWorkspace.getState();
  const title = Path.basename(path);
  const destDir = Path.dirname(newPath);

  const doMove = () => {
    fs.renameSync(path, newPath);

    // 更新编辑器路径
    for (const editor of workspace.editors) {
      // 更新被移动文件/文件夹内的编辑器
      if (editor.path.startsWith(path)) {
        editor.dispatch?.("rename", destDir + "/" + Path.basename(editor.path));
      }
      console.log("editor move", editor.path === newPath, editor.path, newPath);

      // 刷新目标位置的编辑器
      if (editor.path.startsWith(newPath)) {
        console.log("editor reload", editor.path === newPath, editor.path, newPath);
        editor.dispatch?.("refresh");
      }
    }
  };

  // 目标不存在，直接移动
  if (!fs.existsSync(newPath)) {
    doMove();
    return;
  }

  // 目标存在，显示替换确认对话框
  const alert = modal.confirm({
    centered: true,
    content: (
      <Flex vertical gap="middle">
        <div>
          <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
        </div>
        <div>{i18n.t("explorer.replaceFile", { name: title })}</div>
      </Flex>
    ),
    footer: (
      <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
        <Flex vertical gap="6px">
          <Button
            danger
            onClick={() => {
              console.log("close file", newPath);
              workspace.close(path);
              doMove();
              alert.destroy();
            }}
          >
            {i18n.t("replace")}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              alert.destroy();
            }}
          >
            {i18n.t("cancel")}
          </Button>
        </Flex>
      </Flex>
    ),
  });
};

/**
 * 显示删除文件确认对话框
 * 
 * @param path 文件路径
 * 
 * 功能：
 * 1. 显示警告对话框
 * 2. 用户确认后移动到系统回收站（可恢复）
 * 3. 如果文件正在编辑，先关闭编辑器
 * 
 * 注意：
 * - 使用系统回收站，不是永久删除
 * - Windows: 回收站
 * - macOS: 废纸篓
 * - Linux: 回收站
 */
const alertDeleteFile = (path: string) => {
  const workspace = useWorkspace.getState();
  const title = Path.basename(path);
  const alert = modal.confirm({
    centered: true,
    content: (
      <Flex vertical gap="middle">
        <div>
          <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
        </div>
        <div>{i18n.t("explorer.deleteFile", { name: title })}</div>
      </Flex>
    ),
    footer: (
      <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
        <Flex vertical gap="6px">
          <Button
            onClick={() => {
              alert.destroy();
              // 如果正在编辑，先关闭
              if (path === workspace.editing?.path) {
                workspace.close(path);
              }
              // 移动到回收站
              ipcRenderer.invoke("trash-item", path);
            }}
          >
            {i18n.t("moveToTrash")}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              alert.destroy();
            }}
          >
            {i18n.t("cancel")}
          </Button>
        </Flex>
        <div style={{ fontSize: "11px", textAlign: "center" }}>
          {i18n.t("explorer.restoreFileInfo")}
        </div>
      </Flex>
    ),
  });
};

/**
 * 显示删除文件夹确认对话框
 * 
 * @param path 文件夹路径
 * 
 * 功能：
 * 1. 显示警告对话框
 * 2. 用户确认后移动到系统回收站
 * 3. 关闭该文件夹内所有打开的编辑器
 * 
 * 注意：
 * - 会递归删除整个文件夹
 * - 自动关闭文件夹内所有打开的文件
 */
const alertDeleteFolder = (path: string) => {
  const workspace = useWorkspace.getState();
  const title = Path.basename(path);
  const alert = modal.confirm({
    centered: true,
    content: (
      <Flex vertical gap="middle">
        <div>
          <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
        </div>
        <div>{i18n.t("explorer.deleteFolder", { name: title })}</div>
      </Flex>
    ),
    footer: (
      <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
        <Flex vertical gap="6px">
          <Button
            onClick={() => {
              // 关闭文件夹内所有打开的编辑器
              workspace.editors.forEach((editor) => {
                if (editor.path.startsWith(path + "/")) {
                  workspace.close(editor.path);
                }
              });
              // 移动到回收站
              ipcRenderer.invoke("trash-item", path);
              alert.destroy();
            }}
          >
            {i18n.t("moveToTrash")}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              alert.destroy();
            }}
          >
            {i18n.t("cancel")}
          </Button>
        </Flex>
        <div style={{ fontSize: "11px", textAlign: "center" }}>
          {i18n.t("explorer.restoreFileInfo")}
        </div>
      </Flex>
    ),
  });
};

/**
 * Explorer 组件主体
 * 
 * 功能模块：
 * 1. 文件树：显示和管理项目文件
 * 2. 节点定义树：显示可用的行为树节点
 * 3. 右键菜单：文件/文件夹操作
 * 4. 键盘快捷键：快速操作
 * 5. 拖拽支持：文件移动、节点拖拽
 * 
 * 状态管理：
 * - selectedKeys: 当前选中的文件
 * - expandedKeys: 展开的文件夹
 * - copyFile: 复制的文件路径（用于粘贴）
 * - newName: 重命名时的新名称
 * - contextMenu: 右键菜单内容
 * 
 * 数据流：
 * 用户操作 → dispatch(event) → 文件系统操作 → workspace更新 → UI刷新
 */
export const Explorer: FC = () => {
  // ============ 状态订阅 ============

  /**
   * 从 workspace store 订阅需要的状态和方法
   * 使用 useShallow 避免不必要的重渲染
   */
  const workspace = useWorkspace(
    useShallow((state) => ({
      close: state.close,
      editing: state.editing,
      editingNodeDef: state.editingNodeDef,
      editors: state.editors,
      fileTree: state.fileTree,
      nodeDefs: state.nodeDefs,
      workdir: state.workdir,
      onEditingNodeDef: state.onEditingNodeDef,
      open: state.open,
    }))
  );

  const { t } = useTranslation();

  // ============ 文件树状态 ============

  /** 当前选中的文件路径 */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  /** 展开的文件夹路径列表 */
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(
    workspace.fileTree?.path ? [workspace.fileTree.path] : []
  );

  /** 复制的文件路径（用于粘贴） */
  const [copyFile, setCopyFile] = useState("");

  /** 重命名时的新名称（null 表示不在重命名状态） */
  const [newName, setNewName] = useState<string | null>(null);

  /** 右键菜单内容 */
  const [contextMenu, setContextMenu] = useState<ItemType[]>([]);

  // ============ 节点定义树状态 ============

  const rootNodedefName = "nodeTree.root";

  /** 选中的节点定义 */
  const [selectedNodedefKeys, setSelectedNodedefKeys] = useState<string[]>([]);

  /** 展开的节点定义分组 */
  const [expandedNodedefKeys, setExpandedNodedefKeys] = useState<React.Key[]>([rootNodedefName]);

  // ============ 设置文件树根节点图标 ============

  if (workspace.fileTree) {
    workspace.fileTree.icon = (
      <Flex justify="center" align="center" style={{ height: "100%" }}>
        <FaSwatchbook />
      </Flex>
    );
  }

  // ============ 创建节点定义树 ============

  /**
   * 根据节点定义创建树结构
   * useMemo 避免不必要的重新计算
   */
  const nodeTree = useMemo(
    () => createNodeTree(rootNodedefName, workspace.nodeDefs),
    [t, workspace.nodeDefs]
  );

  // ============ 创建分类树 ============

  /**
   * 配置定义树 - 显示 cfgs 目录下的文件
   */
  const configTree = useMemo(() => {
    const cfgFiles = extractDirectoryFiles(workspace.fileTree, "cfgs");
    return createCategoryTree(
      t("explorer.configDefinitions") || "配置定义",
      "category.configs",
      cfgFiles,
      <Flex justify="center" align="center" style={{ height: "100%" }}>
        <FiCommand />
      </Flex>
    );
  }, [workspace.fileTree, t]);

  /**
   * 变量定义树 - 显示 vars 目录下的文件
   */
  const variableTree = useMemo(() => {
    const varFiles = extractDirectoryFiles(workspace.fileTree, "vars");
    return createCategoryTree(
      t("explorer.variableDefinitions") || "变量定义",
      "category.variables",
      varFiles,
      <Flex justify="center" align="center" style={{ height: "100%" }}>
        <BsBoxFill />
      </Flex>
    );
  }, [workspace.fileTree, t]);

  /**
   * 过滤后的文件树 - 用于显示，排除 cfgs 和 vars 目录
   */
  const filteredFileTree = useMemo(() => {
    return filterFileTree(workspace.fileTree, ["cfgs", "vars"]);
  }, [workspace.fileTree]);

  // ============ 自动展开选中的文件 ============

  /**
   * 当切换编辑器时，自动展开并滚动到对应文件
   * 
   * 效果：
   * 1. 计算需要展开的父文件夹
   * 2. 合并当前已展开的文件夹
   * 3. 滚动到文件位置
   * 4. 选中该文件
   */
  useEffect(() => {
    if (workspace.editing) {
      const keys: React.Key[] = [];
      resolveKeys(workspace.editing.path, workspace.fileTree!, keys);

      // 合并已展开的 keys
      for (const k of expandedKeys) {
        if (keys.indexOf(k) === -1) {
          keys.push(k);
        }
      }

      // 滚动到视图（如果不在节点定义树中）
      if (!selectedNodedefKeys.includes(workspace.editing.path)) {
        scrollIntoView(workspace.editing.path);
      }

      setExpandedKeys(keys);
      setSelectedKeys([workspace.editing.path]);
    }
  }, [workspace.editing]);

  // ============ 自动展开选中的节点定义 ============

  /**
   * 当查看节点定义时，自动展开并滚动到对应节点
   */
  useEffect(() => {
    if (workspace.editingNodeDef) {
      const def = workspace.editingNodeDef.data;
      const path = workspace.editingNodeDef.path ?? `${def.name}(${def.group?.[0] ?? ""})`;
      const keys: React.Key[] = [];

      resolveKeys(path, nodeTree, keys);
      for (const k of expandedNodedefKeys) {
        if (keys.indexOf(k) === -1) {
          keys.push(k);
        }
      }

      // 滚动到视图（如果不是外部节点定义）
      if (!workspace.editingNodeDef.path) {
        scrollIntoView(path);
      }

      setExpandedNodedefKeys(keys);
      setSelectedNodedefKeys([path]);
    }
  }, [t, workspace.editingNodeDef]);

  // ============ 键盘快捷键 ============

  const keysRef = useRef<HTMLDivElement>(null);

  /**
   * F2 / Enter (macOS): 重命名选中的文件
   */
  useKeyPress([Hotkey.F2, isMacos ? Hotkey.Enter : ""], keysRef, (event) => {
    event.preventDefault();
    const node = findFile(selectedKeys[0], workspace.fileTree!);
    if (node && node !== workspace.fileTree && !node.editing) {
      dispatch("rename", node);
    }
  });

  /**
   * Delete / Cmd+Delete: 删除选中的文件
   */
  useKeyPress([Hotkey.Delete, isMacos ? Hotkey.MacDelete : ""], keysRef, (event) => {
    event.preventDefault();
    const node = findFile(selectedKeys[0], workspace.fileTree!);
    if (node && node !== workspace.fileTree) {
      dispatch("delete", node);
    }
  });

  /**
   * Escape: 取消重命名
   */
  useKeyPress(Hotkey.Escape, keysRef, (event) => {
    event.preventDefault();
    const node = findFile(selectedKeys[0], workspace.fileTree!);
    if (node) {
      node.editing = false;
      setNewName(null);
    }
  });

  /**
   * Ctrl/Cmd + D: 复制文件
   */
  useKeyPress(Hotkey.Duplicate, keysRef, (event) => {
    event.preventDefault();
    const node = findFile(selectedKeys[0], workspace.fileTree!);
    if (node && node.isLeaf) {
      dispatch("duplicate", node);
    }
  });

  /**
   * Ctrl/Cmd + C: 复制文件路径
   */
  useKeyPress(Hotkey.Copy, keysRef, (event) => {
    event.preventDefault();
    const node = findFile(selectedKeys[0], workspace.fileTree!);
    if (node && node.isLeaf) {
      dispatch("copy", node);
    }
  });

  /**
   * Ctrl/Cmd + V: 粘贴文件
   */
  useKeyPress(Hotkey.Paste, keysRef, (event) => {
    event.preventDefault();
    const node = findFile(selectedKeys[0], workspace.fileTree!);
    if (node) {
      dispatch("paste", node);
    }
  });

  // ============ 提交重命名 ============

  /**
   * 完成重命名操作
   * 
   * @param node 要重命名的节点
   * 
   * 处理三种情况：
   * 1. 创建新文件夹 (path 结尾为 "/:")
   * 2. 创建新文件 (path 结尾为 "/.json")
   * 3. 重命名现有文件/文件夹
   * 
   * 验证：
   * - 过滤非法文件名字符
   * - 检查文件是否存在
   * - 自动打开新创建的文件
   */
  const submitRename = (node: FileTreeType) => {
    // 空名称：取消操作
    if (!newName) {
      if (fs.existsSync(node.path)) {
        node.editing = false;
      } else {
        // 删除未保存的临时节点
        const parent = findParent(node, workspace.fileTree);
        if (parent && parent.children) {
          parent.children = parent.children.filter((v) => v !== node);
        }
      }
      setNewName(null);
      return;
    }

    // 创建新文件夹
    if (node.path.endsWith("/:")) {
      node.path = Path.dirname(node.path) + "/" + newName.replace(/[^\w. _-]+/g, "");
      node.title = Path.basename(node.path);
      fs.mkdirSync(node.path);
    }
    // 创建新文件
    else if (node.path.endsWith("/.json")) {
      node.path = Path.dirname(node.path) + "/" + newName.replace(/[^\w. _-]+/g, "");
      node.title = Path.basename(node.path);
      fs.writeFileSync(node.path, JSON.stringify(b3util.createNewTree(node.title), null, 2));
      workspace.open(node.path);
    }
    // 重命名现有文件
    else {
      const newpath = Path.dirname(node.path) + "/" + newName;
      if (renameFile(node.path, newpath)) {
        setSelectedKeys([newpath]);
      }
    }

    node.editing = false;
    setNewName(null);
  };

  // ============ 事件分发器 ============

  /**
   * 处理所有文件/文件夹操作事件
   * 
   * @param event 事件类型
   * @param node 目标节点
   * @param dest 目标位置（用于移动操作）
   * 
   * 支持的事件：
   * - open: 打开文件
   * - newFile: 新建文件
   * - newFolder: 新建文件夹
   * - paste: 粘贴
   * - copy: 复制
   * - duplicate: 复制文件
   * - delete: 删除
   * - move: 移动（拖拽）
   * - revealFile: 在文件管理器中显示
   * - rename: 重命名
   * 
   * 数据流：
   * dispatch → 操作文件系统 → workspace更新 → UI自动刷新（文件监听）
   */
  const dispatch = (event: MenuEvent, node: FileTreeType, dest?: FileTreeType) => {
    switch (event) {
      // ========== 打开文件 ==========
      case "open": {
        if (b3util.isTreeFile(node.path)) {
          workspace.open(node.path);
        }
        break;
      }

      // ========== 新建文件夹 ==========
      case "newFolder": {
        const folderNode: FileTreeType = {
          path: node.path + "/:",  // 特殊标记：以 "/:" 结尾表示新文件夹
          title: "",
          children: [],
          editing: true,           // 进入编辑状态
        };
        node.children?.unshift(folderNode);
        setNewName("");
        // 展开父文件夹
        if (expandedKeys.indexOf(node.path) === -1) {
          setExpandedKeys([node.path, ...expandedKeys]);
        }
        break;
      }

      // ========== 新建文件 ==========
      case "newFile": {
        const folderNode: FileTreeType = {
          path: node.path + "/.json",  // 特殊标记：以 "/.json" 结尾表示新文件
          title: ".json",
          isLeaf: true,
          editing: true,               // 进入编辑状态
        };
        node.children?.unshift(folderNode);
        setNewName("");
        // 展开父文件夹
        if (expandedKeys.indexOf(node.path) === -1) {
          setExpandedKeys([node.path, ...expandedKeys]);
        }
        break;
      }

      // ========== 粘贴文件 ==========
      case "paste": {
        if (copyFile) {
          // 确定目标文件夹
          let folder = node.path;
          if (node.isLeaf) {
            folder = Path.dirname(node.path);
          }
          const newPath = folder + "/" + Path.basename(copyFile);

          // 检查目标文件是否存在
          if (fs.existsSync(newPath)) {
            if (node.path === newPath) {
              // 目标是自己，执行复制操作
              dispatch("duplicate", node);
            } else {
              // 目标已存在，显示替换确认
              alertReplaceFile(node.path, newPath);
            }
          } else {
            // 直接复制
            fs.copyFileSync(copyFile, newPath);
          }
        }
        break;
      }

      // ========== 复制文件路径 ==========
      case "copy": {
        if (b3util.isTreeFile(node.path)) {
          setCopyFile(node.path);
        }
        break;
      }

      // ========== 复制文件 ==========
      case "duplicate": {
        if (b3util.isTreeFile(node.path)) {
          // 自动生成不重复的文件名：原文件名 + 数字
          for (let i = 1; ; i++) {
            const dupName = Path.basenameWithoutExt(node.path) + " " + i + ".json";
            const dupPath = Path.dirname(node.path) + "/" + dupName;
            if (!fs.existsSync(dupPath)) {
              fs.copyFileSync(node.path, dupPath);
              setSelectedKeys([dupPath]);
              break;
            }
          }
        }
        break;
      }

      // ========== 删除文件/文件夹 ==========
      case "delete": {
        // 不允许删除根节点
        if (node === workspace.fileTree) {
          return;
        }
        if (node.isLeaf) {
          alertDeleteFile(node.path);
        } else {
          alertDeleteFolder(node.path);
        }
        break;
      }

      // ========== 移动文件/文件夹（拖拽） ==========
      case "move": {
        try {
          // 确定目标文件夹
          const destDir = dest?.children ? dest.path : Path.dirname(dest!.path);

          // 检查是否移动到同一文件夹
          if (destDir === Path.dirname(node.path)) {
            return;
          }

          const newPath = destDir + "/" + Path.basename(node.path);
          doMoveFile(node.path, newPath);
        } catch (error) {
          console.error("move file:", error);
        }
        break;
      }

      // ========== 在文件管理器中显示 ==========
      case "revealFile":
        ipcRenderer.invoke("show-item-in-folder", node.path);
        break;

      // ========== 重命名 ==========
      case "rename": {
        if (b3util.isTreeFile(node.path)) {
          node.editing = true;
          setNewName("");
        }
        break;
      }
    }
  };

  // ============ 右键菜单点击处理 ============

  /**
   * 处理右键菜单项的点击事件
   * 
   * @param info 菜单信息
   */
  const onClick = (info: MenuInfo) => {
    const node = findFile(selectedKeys[0], workspace.fileTree!) ?? workspace.fileTree;
    if (node) {
      dispatch(info.key as MenuEvent, node);
    }
  };

  // ============ 渲染 ============

  // 未加载文件树时不渲染
  if (!workspace.fileTree) {
    return null;
  }

  return (
    <Flex
      className="b3-explorer"
      vertical
      ref={keysRef}
      tabIndex={-1}
      style={{ height: "100%" }}
      onContextMenuCapture={() => {
        // 设置默认的文件夹右键菜单
        setContextMenu(createFolderContextMenu(copyFile));
      }}
    >
      {/* // ========== 标题栏 ========== */}
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("explorer.title")}</span>
      </div>

      {/* // ========== 主内容区（文件树 + 节点定义树） ========== */}
      <Flex
        vertical
        className={isMacos ? undefined : "b3-overflow"}
        style={{ overflow: "auto", height: "100%", paddingBottom: "20px" }}
      >
        {/* // ========== 文件树 ========== */}
        <Dropdown menu={{ items: contextMenu, onClick }} trigger={["contextMenu"]}>
          <div>
            <DirectoryTree
              virtual                                    // 虚拟滚动（性能优化）
              tabIndex={-1}                             // 避免聚焦
              treeData={filteredFileTree ? [filteredFileTree] : []}
              fieldNames={{ key: "path", title: "path" }} // 字段映射
              expandedKeys={expandedKeys}               // 展开的节点
              selectedKeys={selectedKeys}               // 选中的节点
              // 展开/折叠处理
              onExpand={(keys) => {
                setExpandedKeys(keys);
              }}
              // 右键点击处理
              onRightClick={(info) => {
                if (info.node.isLeaf) {
                  setContextMenu(createFileContextMenu(info.node));
                }
                setSelectedKeys([info.node.path]);
              }}
              // 单击选择处理 - 打开文件的入口
              onSelect={(_, info) => {
                const node = info.selectedNodes.at(0);
                if (node && !node.editing) {
                  dispatch("open", node);  // 触发打开文件
                  setSelectedKeys([node.path]);
                }
              }}
              // 拖拽处理 - 文件移动
              onDrop={(info) => {
                dispatch("move", info.dragNode, info.node);
              }}
              // 节点标题渲染
              titleRender={(node) => {
                const value = Path.basename(node.title);

                // 编辑模式：显示输入框
                if (node.editing) {
                  return (
                    <div style={{ display: "inline-flex" }}>
                      <Input
                        defaultValue={value}
                        autoFocus
                        style={{ padding: "0px 0px", borderRadius: "2px" }}
                        onFocus={(e) => {
                          // 自动选中文件名（不含扩展名）
                          if (value.startsWith(".")) {
                            e.target.setSelectionRange(0, 0);
                          } else {
                            e.target.setSelectionRange(0, value.lastIndexOf("."));
                          }
                        }}
                        onChange={(e) => setNewName(e.target.value)}
                        onPressEnter={() => {
                          if (newName) {
                            submitRename(node);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyUp={(e) => {
                          // ESC 取消重命名
                          if (e.code === Hotkey.Escape) {
                            if (!fs.existsSync(node.path)) {
                              const parent = findParent(node, workspace.fileTree);
                              if (parent && parent.children) {
                                parent.children = parent.children.filter((v) => v !== node);
                              }
                            }
                            node.editing = false;
                            setNewName(null);
                          }
                        }}
                        onBlur={() => submitRename(node)}
                      ></Input>
                    </div>
                  );
                }
                // 普通模式：显示文件名
                else {
                  return (
                    <div style={{ flex: 1, width: 0, minWidth: 0 }}>
                      <div
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {node.title}
                      </div>
                    </div>
                  );
                }
              }}
              // 拖拽开始处理 - 传递文件路径
              onDragStart={(e) => {
                e.event.dataTransfer.setData("explore-file", e.node.path);
              }}
              // 拖拽配置
              draggable={
                newName !== null
                  ? false  // 重命名时禁用拖拽
                  : {
                    icon: false,
                    nodeDraggable: (node) => {
                      const fileNode = node as unknown as FileTreeType;
                      // 文件夹和行为树文件可拖拽
                      return !!fileNode.children || b3util.isTreeFile(fileNode.path);
                    },
                  }
              }

              switcherIcon={<DownOutlined />}
            />
          </div>
        </Dropdown>

        {/* ========== 节点定义树 ========== */}
        <DirectoryTree
          virtual
          tabIndex={-1}
          fieldNames={{ key: "path", title: "path" }}
          treeData={[nodeTree]}
          expandedKeys={expandedNodedefKeys}
          selectedKeys={selectedNodedefKeys}

          onExpand={(keys) => {
            setExpandedNodedefKeys(keys);
          }}

          draggable={{ icon: false, nodeDraggable: (node) => !!node.isLeaf }}

          titleRender={(node) => (
            <div style={{ flex: 1, width: 0, minWidth: 0 }}>
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.title}
              </div>
            </div>
          )}

          // 点击节点定义 - 在属性面板显示详情
          onSelect={(_, info) => {
            const node = info.node;
            if (node) {
              if (node.isLeaf) {
                workspace.onEditingNodeDef({
                  data: node.def!,
                  path: node.path,
                });
              }
              setSelectedNodedefKeys([node.path]);
            }
          }}

          // 拖拽开始 - 传递节点名称到画布
          onDragStart={(e) => {
            e.event.dataTransfer.setData("explore-node", e.node.def?.name ?? "");
          }}

          switcherIcon={<DownOutlined />}
        />

        {/* ========== 配置定义树 ========== */}
        {configTree.children && configTree.children.length > 0 && (
          <DirectoryTree
            virtual
            tabIndex={-1}
            fieldNames={{ key: "path", title: "path" }}
            treeData={[configTree]}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}

            onExpand={(keys) => {
              setExpandedKeys(keys);
            }}

            titleRender={(node) => (
              <div style={{ flex: 1, width: 0, minWidth: 0 }}>
                <div
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {node.title}
                </div>
              </div>
            )}

            // 点击配置文件 - 打开文件
            onSelect={(_, info) => {
              const node = info.selectedNodes.at(0);
              if (node && node.isLeaf) {
                // 找到原始文件节点并打开
                const originalNode = findFile(node.path, workspace.fileTree!);
                if (originalNode) {
                  dispatch("open", originalNode);
                  setSelectedKeys([node.path]);
                }
              }
            }}

            switcherIcon={<DownOutlined />}
          />
        )}

        {/* ========== 变量定义树 ========== */}
        {variableTree.children && variableTree.children.length > 0 && (
          <DirectoryTree
            virtual
            tabIndex={-1}
            fieldNames={{ key: "path", title: "path" }}
            treeData={[variableTree]}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}

            onExpand={(keys) => {
              setExpandedKeys(keys);
            }}

            titleRender={(node) => (
              <div style={{ flex: 1, width: 0, minWidth: 0 }}>
                <div
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {node.title}
                </div>
              </div>
            )}

            // 点击变量文件 - 打开文件
            onSelect={(_, info) => {
              const node = info.selectedNodes.at(0);
              if (node && node.isLeaf) {
                // 找到原始文件节点并打开
                const originalNode = findFile(node.path, workspace.fileTree!);
                if (originalNode) {
                  dispatch("open", originalNode);
                  setSelectedKeys([node.path]);
                }
              }
            }}

            switcherIcon={<DownOutlined />}
          />
        )}
      </Flex>
    </Flex>
  );
};
