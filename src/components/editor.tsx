/**
 * Editor 组件 - 行为树可视化编辑器
 * 
 * 主要职责：
 * - 渲染并管理行为树的图形编辑器（Graph 实例）
 * - 处理节点的增删改查、复制粘贴、撤销重做等操作
 * - 提供节点搜索与跳转能力（内容/ID）
 * - 通过 dispatch 统一处理来自 Workspace/菜单的编辑事件
 * 
 * 架构与数据流：
 * Workspace/快捷键/菜单 → editor.dispatch → Graph 方法 → 更新 UI/状态
 * 
 * 注释风格：
 * - 文件头：说明模块职责与数据流
 * - 函数/方法：JSDoc 描述作用、参数与返回值
 * - 行内注释：解释关键分支与非显而易见逻辑
 */
import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined } from "@ant-design/icons";
import { useSize } from "ahooks";
import { Button, Dropdown, Flex, FlexProps, Input, InputRef, MenuProps } from "antd";
import * as fs from "fs";
import React, { FC, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDelete } from "react-icons/fi";
import { IoMdReturnLeft } from "react-icons/io";
import { RiFocus3Line } from "react-icons/ri";
import { VscCaseSensitive } from "react-icons/vsc";
import { useDebounceCallback } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import {
  EditEvent,
  EditNode,
  EditorStore,
  EditTree,
  useWorkspace,
} from "../contexts/workspace-context";
import i18n from "../misc/i18n";
import { Hotkey, isMacos } from "../misc/keys";
import { mergeClassNames } from "../misc/util";
import { FilterOption, Graph } from "./graph";
import "./register-node";

export interface EditorProps extends React.HTMLAttributes<HTMLElement> {
  data: EditorStore;
  onChange: () => void;
}

/**
 * 创建右键菜单项
 * 
 * 说明：
 * - 使用 AntD Dropdown 的 items 配置
 * - 键位展示根据平台（Mac/Win）动态切换
 * 
 * @returns AntD Menu items 配置数组
 */
const createMenu = () => {
  const t = i18n.t;
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
          <div>{t("copy")}</div>
          <div>{isMacos ? "⌘ C" : "Ctrl+C"}</div>
        </MenuItem>
      ),
      key: "copy",
    },
    {
      label: (
        <MenuItem>
          <div>{t("paste")}</div>
          <div>{isMacos ? "⌘ V" : "Ctrl+V"}</div>
        </MenuItem>
      ),
      key: "paste",
    },
    {
      label: (
        <MenuItem>
          <div>{t("replace")}</div>
          <div>{isMacos ? "⇧ ⌘ V" : "Ctrl+Shift+V"} </div>
        </MenuItem>
      ),
      key: "replace",
    },
    {
      label: (
        <MenuItem>
          <div>{t("insertNode")}</div>
          <div>{isMacos ? <IoMdReturnLeft /> : "Enter"}</div>
        </MenuItem>
      ),
      key: "insert",
    },
    {
      label: (
        <MenuItem>
          <div>{t("deleteNode")}</div>
          <div>{isMacos ? <FiDelete /> : "Backspace"}</div>
        </MenuItem>
      ),
      key: "delete",
    },
    {
      label: (
        <MenuItem>
          <div>{t("editSubtree")}</div>
          <div></div>
        </MenuItem>
      ),
      key: "editSubtree",
    },
    {
      label: (
        <MenuItem>
          <div>{t("saveAsSubtree")}</div>
          <div></div>
        </MenuItem>
      ),
      key: "saveAsSubtree",
    },
  ];
  return arr;
};

/**
 * Editor 组件
 * 
 * 负责：
 * - 初始化 Graph 并管理其生命周期
 * - 处理节点搜索、聚焦、结果导航
 * - 响应 workspace 发来的编辑事件（通过 dispatch）
 * 
 * @param props.data 编辑器状态（包含当前树数据与路径）
 * @param props.onChange 保存完成后的回调（用于刷新状态）
 * @returns React Element
 */
export const Editor: FC<EditorProps> = ({ onChange, data: editor, ...props }) => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      editing: state.editing,
    }))
  );

  const searchInputRef = useRef<InputRef>(null);
  const graphRef = useRef(null);
  const sizeRef = useRef(null);
  const editorSize = useSize(sizeRef);
  const { t } = useTranslation();
  const menuItems = useMemo(() => createMenu(), [t]);
  const [graph, setGraph] = useState<Graph>(null!);

  const [showingSearch, setShowingSearch] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>({
    results: [],
    index: 0,
    filterStr: "",
    filterCase: false,
    filterFocus: true,
    filterType: "content",
    placeholder: "",
  });

  /**
   * 执行搜索并更新搜索结果
   * 
   * 流程：
   * 1. 清空旧结果
   * 2. 根据过滤条件在整棵树中高亮匹配项
   * 3. 若有结果：展开并聚焦当前索引的节点；否则：取消选中
   * 
   * @param option 搜索过滤选项
   */
  const onSearchChange = async (option: FilterOption) => {
    option.results.length = 0;
    graph.hightlightSearch(option, graph.data.root);
    setFilterOption({
      ...option,
    });
    if (option.results.length > 0) {
      const idx = option.index < option.results.length ? option.index : 0;
      // 展开树以确保目标节点可见
      graph.expandElement();
      // 聚焦到匹配结果节点
      graph.focusNode(option.results[idx]);
    } else {
      // 无匹配项时清空选中状态
      graph.selectNode(null);
    }
  };

  /**
   * 仅刷新高亮状态，不改变当前索引
   */
  const updateSearchState = () => {
    const option = { ...filterOption };
    option.results.length = 0;
    graph.hightlightSearch(option, graph.data.root);
    setFilterOption({
      ...option,
    });
  };

  const onDebounceSearchChange = useDebounceCallback(onSearchChange, 100);

  /**
   * 跳转到下一个搜索结果
   */
  const nextResult = () => {
    const { results, index } = filterOption;
    if (results.length > 0) {
      const idx = (index + 1) % results.length;
      setFilterOption({ ...filterOption, index: idx });
      graph.expandElement();
      graph.focusNode(results[idx]);
    }
  };

  /**
   * 跳转到上一个搜索结果
   */
  const prevResult = () => {
    const { results, index } = filterOption;
    if (results.length > 0) {
      const idx = (index + results.length - 1) % results.length;
      setFilterOption({ ...filterOption, index: idx });
      graph.expandElement();
      graph.focusNode(results[idx]);
    }
  };

  /**
   * 切换搜索类型并处理显示状态
   * 
   * @param type 搜索类型（按内容或按ID）
   */
  const searchByType = (type: FilterOption["filterType"]) => {
    let placeholder = "";
    const filterType = type;
    // todo multiple parameter format judgment
    switch (type) {
      case "id":
        placeholder = t("jumpNode");
        break;
      default:
        placeholder = t("searchNode");
        break;
    }
    if (!showingSearch) {
      setFilterOption({ ...filterOption, placeholder, filterType });
      setShowingSearch(true);
      return;
    }
    if (filterOption.filterType === type) {
      return searchInputRef.current?.focus();
    }
    setShowingSearch(false);
    setTimeout(() => {
      setShowingSearch(true);
      setFilterOption({ ...filterOption, placeholder, filterType });
      searchInputRef.current?.focus();
    }, 50);
  };

  /**
   * 处理编辑器内的按键事件
   * 
   * 支持：Enter 跳转下一个；Ctrl/Cmd+F 内容搜索；Ctrl/Cmd+G ID 跳转
   * 
   * @param e 键盘事件
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === Hotkey.Enter) {
      nextResult();
    } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyF") {
      searchByType("content");
    } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyG") {
      searchByType("id");
    }
    e.stopPropagation();
  };

  /**
   * 编辑事件分发器
   * 
   * 统一响应 Workspace/菜单发送的编辑事件并调用 Graph 对应方法
   * 在节点操作后，必要时刷新搜索高亮状态
   * 
   * @param event 编辑事件类型
   * @param data 附加数据（如重命名的新路径、更新的树/节点等）
   */
  editor.dispatch = async (event: EditEvent, data: unknown) => {
    if (event === "close") {
      // 关闭当前编辑器：销毁图形实例
      graph.destroy();
    } else if (event === "copy") {
      graph.copyNode();
    } else if (event === "paste") {
      await graph.pasteNode();
    } else if (event === "delete") {
      await graph.deleteNode();
    } else if (event === "insert") {
      await graph.createNode();
    } else if (event === "replace") {
      graph.replaceNode();
    } else if (event === "save") {
      await graph.save();
      onChange();
      editor.changed = false;
      editor.mtime = Date.now();
      updateSearchState();
    } else if (event === "undo") {
      await graph.undo();
      updateSearchState();
    } else if (event === "redo") {
      await graph.redo();
      updateSearchState();
    } else if (event === "refresh") {
      await graph.refresh();
      editor.mtime = fs.statSync(editor.path).mtimeMs;
    } else if (event === "reload") {
      graph.reload();
      editor.mtime = fs.statSync(editor.path).mtimeMs;
      editor.changed = false;
    } else if (event === "rename") {
      editor.path = data as string;
    } else if (event === "updateTree") {
      graph.updateTree(data as EditTree);
    } else if (event === "updateNode") {
      graph.updateNode(data as EditNode);
    } else if (event === "searchNode") {
      searchByType("content");
    } else if (event === "jumpNode") {
      searchByType("id");
    } else if (event === "editSubtree") {
      graph.editSubtree();
    } else if (event === "saveAsSubtree") {
      graph.saveAsSubtree();
    } else if (event === "clickVar") {
      graph.clickVar(data as string);
    }
  };

  if (graph) {
    graph.onChange = () => {
      if (!editor.changed) {
        editor.changed = true;
        onChange();
      }
    };
    graph.onUpdateSearch = () => {
      if (filterOption.filterStr) {
        onSearchChange({
          ...filterOption,
          filterType: "content",
        });
      }
    };
  }

  const refreshGraph = async () => {
    if (graph.hasSubtreeUpdated()) {
      await graph.refreshSubtree();
    } else {
      await graph.refresh();
    }
    if (editor.focusId) {
      graph.focusNode(editor.focusId);
      editor.focusId = null;
    } else if (graph.selectedId) {
      graph.selectNode(graph.selectedId);
    }
  };

  // check should rebuild graph
  useEffect(() => {
    if (!editorSize || (editorSize.width === 0 && editorSize.height === 0)) {
      return;
    }

    if (!graph) {
      setGraph(new Graph(editor, graphRef));
    }

    if (graph && workspace.editing === editor) {
      graph.setSize(editorSize.width, editorSize.height);
      refreshGraph();
    }
  }, [editorSize, workspace.editing, graph]);

  useEffect(() => {
    if (graph) {
      graph.refresh();
    }
  }, [t]);

  return (
    <div
      {...props}
      className="b3-editor"
      ref={sizeRef}
      tabIndex={-1}
      style={{ maxWidth: "inherit", maxHeight: "inherit" }}
    >
      {showingSearch && (
        <Flex
          style={{
            position: "absolute",
            width: "100%",
            justifyContent: "end",
            paddingRight: "10px",
            paddingTop: "10px",
            zIndex: 100,
          }}
        >
          <Flex
            style={{
              backgroundColor: "#161b22",
              padding: "4px 10px 4px 10px",
              borderRadius: "4px",
              borderLeft: "3px solid #f78166",
              boxShadow: "0 0 8px 2px #0000005c",
              alignItems: "center",
            }}
          >
            <Input
              ref={searchInputRef}
              placeholder={filterOption.placeholder}
              autoFocus
              size="small"
              style={{
                borderRadius: "2px",
                paddingTop: "1px",
                paddingBottom: "1px",
                paddingRight: "2px",
              }}
              onChange={(e) =>
                onDebounceSearchChange({
                  ...filterOption,
                  filterStr: e.currentTarget.value,
                  index: 0,
                })
              }
              onKeyDownCapture={handleKeyDown}
              suffix={
                <Flex gap="2px" style={{ alignItems: "center" }}>
                  {filterOption.filterType !== "id" && (
                    <Button
                      type="text"
                      size="small"
                      className={mergeClassNames(
                        "b3-editor-filter",
                        filterOption.filterCase && "b3-editor-filter-selected"
                      )}
                      icon={<VscCaseSensitive style={{ width: "18px", height: "18px" }} />}
                      onClick={() =>
                        onSearchChange({
                          ...filterOption,
                          filterCase: !filterOption.filterCase,
                        })
                      }
                    />
                  )}
                  <Button
                    type="text"
                    size="small"
                    className={mergeClassNames(
                      "b3-editor-filter",
                      filterOption.filterFocus && "b3-editor-filter-selected"
                    )}
                    icon={<RiFocus3Line />}
                    onClick={() => {
                      onSearchChange({
                        ...filterOption,
                        filterFocus: !filterOption.filterFocus,
                      });
                    }}
                  />
                </Flex>
              }
            />
            <div style={{ padding: "0 10px 0 5px", minWidth: "40px" }}>
              {filterOption.results.length
                ? `${filterOption.index + 1}/${filterOption.results.length}`
                : ""}
            </div>
            {filterOption.filterType !== "id" && (
              <Button
                icon={<ArrowDownOutlined />}
                type="text"
                size="small"
                style={{ width: "30px" }}
                disabled={filterOption.results.length === 0}
                onClick={nextResult}
              />
            )}
            {filterOption.filterType !== "id" && (
              <Button
                icon={<ArrowUpOutlined />}
                type="text"
                size="small"
                style={{ width: "30px" }}
                disabled={filterOption.results.length === 0}
                onClick={prevResult}
              />
            )}
            <Button
              icon={<CloseOutlined />}
              type="text"
              size="small"
              style={{ width: "30px" }}
              onClick={() => {
                setShowingSearch(false);
                onSearchChange({
                  results: [],
                  index: 0,
                  filterCase: false,
                  filterFocus: true,
                  filterStr: "",
                  filterType: "content",
                  placeholder: "",
                });
              }}
            />
          </Flex>
        </Flex>
      )}

      <Dropdown
        menu={{ items: menuItems, onClick: (info) => editor.dispatch?.(info.key as EditEvent) }}
        trigger={["contextMenu"]}
      >
        <div tabIndex={-1} style={{ width: "100%", height: "100%" }} ref={graphRef} />
      </Dropdown>
    </div>
  );
};
