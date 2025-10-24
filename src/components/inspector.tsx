/**
 * Inspector 组件群 - 行为树属性与节点参数编辑面板
 * 
 * 主要职责：
 * - TreeInspector：编辑树的基本信息、变量与导入/子树配置
 * - NodeInspector：编辑当前选中节点的参数与连接关系
 * - NodeDefInspector：查看节点定义文档与说明
 * - VarDeclItem：树变量的增删改项
 * 
 * 设计要点：
 * - 使用 AntD Form 管理表单与校验
 * - 结合 workspace 状态实现即时更新（dispatch updateTree/updateNode）
 * - 对表达式参数提供校验与引用统计
 */
import {
    AimOutlined,
    EditOutlined,
    FormOutlined,
    MinusCircleOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import {
    AutoComplete,
    Button,
    Divider,
    Flex,
    Form,
    Input,
    Select,
    Space,
    Switch
} from "antd";
import useFormInstance from "antd/es/form/hooks/useFormInstance";
import TextArea from "antd/es/input/TextArea";
import { DefaultOptionType } from "antd/es/select";
import { FC, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import { useDebounceCallback } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import { EditNode, EditTree, useWorkspace } from "../contexts/workspace-context";
import {
    ArgType,
    ExpressionEvaluator,
    ImportDecl,
    isExprType,
    isJsonType,
    NodeArg,
    NodeData,
    ValueType,
    VarDecl
} from "../misc/b3type";
import {
    checkNodeArgValue,
    formatVariableLabel,
    getNodeArgValueType,
    getVariableDisplayValue,
    isNodeArgArray,
    isNodeArgOptional,
    isValidChildren,
    isValidVariableName,
    isVariadic,
    parseExpr,
} from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import { Hotkey, isMacos } from "../misc/keys";
import { debugVarCheck, logDebug } from "../misc/log";
import { mergeClassNames } from "../misc/util";
import { NodeArguments, NodeInputParams, NodeOutputParams } from "./params";

/**
 * 将形如 "input1?" 或 "input2..." 的字符串解析成 VarDecl 对象
 * 规则：
 * - 末尾带 "?" 表示可选变量（optional = true）
 * - 末尾带 "..." 表示可变参数（variadic = true）
 * - 其余部分作为变量名
 * 默认值：
 * - desc 与 name 相同
 * - type 固定为 CONST_VAR
 * - value_type 固定为 STRING
 */
const parseStringToVarDecl = (str: string): VarDecl => {
    const isOptional = str.endsWith('?');
    const name = str.replace(/[?\.]+$/, '');

    return {
        name,
        desc: name,
        type: ArgType.CONST_VAR,
        value_type: ValueType.STRING,
        optional: isOptional,
    };
};

/**
 * 下拉选项类型扩展
 * 用于变量自动完成、选择器等组件的选项数据结构
 * 在 AntD DefaultOptionType 基础上强制 value 为字符串类型
 */
interface OptionType extends DefaultOptionType {
    value: string;
}

/**
 * 树变量项接口，继承自 VarDecl
 * 在变量声明基础上增加引用计数，用于统计变量在树中的使用次数
 * count 为可选字段，未定义时表示未统计或计数为 0
 */
interface VarItem extends VarDecl {
    count?: number;
}

/**
 * VarItemProps - 单个树变量编辑项的属性接口
 * 用于 VarDeclItem 组件的 props 定义
 */
interface VarItemProps {
    /** Form.List 的索引键，用于定位当前变量项 */
    name: number;
    /** 是否禁用编辑（如配置文件场景） */
    disabled?: boolean;
    /** 当前变量项的完整数据（含引用计数） */
    value?: VarItem;
    /** 变量数据变更时的回调，用于同步到 Form */
    onChange?: (value: VarItem) => void;
    /** 删除当前变量项的回调，支持单个或批量删除 */
    onRemove?: (name: number | number[]) => void;
}

/**
 * VarSelectorProps - 变量选择器属性接口
 * 用于在节点参数中选择或输入变量，支持对象变量、配置变量等
 */
interface VarSelectorProps {
    /** 当前选中的变量，包含变量名和类型 */
    value?: { name: string; type: string };
    /** 变量变更时的回调，返回 undefined 表示清空选择 */
    onChange?: (value: { name: string; type: string } | undefined) => void;
    /** 是否禁用选择器 */
    disabled?: boolean;
    /** 输入框占位文本 */
    placeholder?: string;
    /** 失去焦点时的回调 */
    onBlur?: () => void;
}

/**
 * 检查变量是否存在
 * @param varName 变量名
 * @param usingVars 可用变量集合
 * @returns 是否存在
 */
const isVariableExists = (varName: string, usingVars: Record<string, VarDecl> | null): boolean => {
    debugVarCheck("Inspector.isVariableExists", varName, usingVars);

    if (!usingVars || !varName) {
        logDebug("Inspector.isVariableExists", `Early return: usingVars=${!!usingVars}, varName="${varName}"`);
        return false;
    }

    const exists = !!usingVars[varName];
    logDebug(
        "Inspector.isVariableExists",
        exists ? `Found variable "${varName}"` : `Variable "${varName}" not found`
    );
    return exists;
};

/**
 * VarDeclItem 组件 - 单个树变量编辑项
 * 
 * @param name Form.List 的索引键
 * @param disabled 是否禁用编辑
 * @param value 初始变量值
 * @param onChange 值变更回调（提交表单）
 * @param onRemove 删除当前变量项回调
 */
const VarDeclItem: FC<VarItemProps> = ({ name, onChange, onRemove, disabled, ...props }) => {

    const { t } = useTranslation();
    const form = useFormInstance();
    const { editing } = useWorkspace(
        useShallow((state) => ({
            editing: state.editing,
        }))
    );

    // 判断当前编辑的文件是否为cfg/或vars/目录下的文件，如果是则禁用编辑
    const isConfigFile = (editing?.path?.includes('/cfg/') || editing?.path?.includes('/vars/')) ?? false;
    const isDisabled = disabled || isConfigFile;

    // 获取当前表单值
    const currentValue = form.getFieldValue(['vars', name]) || { name: "", desc: "", type: ArgType.OBJECT_VAR };

    const onSubmit = () => {
        if (isConfigFile) return; // 配置文件不允许修改
        form.submit();
    };

    // 变量类型选项
    const typeOptions = [
        { label: t("tree.vars.type.const"), value: ArgType.CONST_VAR },
        { label: t("tree.vars.type.object"), value: ArgType.OBJECT_VAR },
        { label: t("tree.vars.type.config"), value: ArgType.CFG_VAR },
        { label: t("tree.vars.type.code"), value: ArgType.CODE_VAR },
    ];

    // 根据类型渲染不同的值编辑器
    const renderValueEditor = () => {
        const currentType = currentValue.type || ArgType.OBJECT_VAR;

        // 根据变量类型渲染对应的值编辑器
        switch (currentType) {
            // 常量类型：提供普通输入框
            case ArgType.CONST_VAR:
                return (
                    /* 常量类型变量的值输入框：直接绑定到 Form 中当前变量的 value 字段，失焦时自动提交表单以触发保存 */
                    <Form.Item name={[name, "value"]} style={{ margin: 0 }}>
                        <Input
                            disabled={isDisabled}
                            placeholder={t("tree.vars.value.const")}
                            onBlur={onSubmit}
                        />
                    </Form.Item>
                );

            // 对象变量：仅展示提示文本，运行时由引擎注入
            case ArgType.OBJECT_VAR:
                return (
                    <Input
                        disabled={true}
                        value={t("tree.vars.value.runtime")}
                        style={{ color: "#888" }}
                    />
                );

            // 配置变量：提供普通输入框
            case ArgType.CFG_VAR:
                return (
                    <Form.Item name={[name, "value"]} style={{ margin: 0 }}>
                        <Input
                            disabled={isDisabled}
                            placeholder={t("tree.vars.value.config")}
                            onBlur={onSubmit}
                        />
                    </Form.Item>
                );

            // 代码变量：提供多行文本域，方便输入表达式
            case ArgType.CODE_VAR:
                return (
                    <Form.Item name={[name, "value"]} style={{ margin: 0 }}>
                        <TextArea
                            disabled={isDisabled}
                            placeholder={t("tree.vars.value.code")}
                            rows={2}
                            onBlur={onSubmit}
                        />
                    </Form.Item>
                );

            // 兜底：无匹配类型时返回空
            default:
                return null;
        }
    };

    return (
        /* VarDeclItem 组件布局：垂直双行结构
        * 第一行：变量基本信息（引用计数器 + 变量名 + 描述 + 删除按钮）
        * 第二行：变量类型和值编辑器
        * 整体间距：4px，确保紧凑而清晰的布局
        */
        <Flex vertical gap={4}>
            {/* 第一行：变量基本信息行 - 水平布局，元素间距4px */}
            <Flex gap={4}>
                {/* 紧凑组合：引用计数器 + 变量名 + 描述，形成一个整体的输入组合 */}
                <Space.Compact>
                    {/* 引用计数器：显示变量被引用的次数，可点击定位到引用位置
                    * 布局特点：
                    * - 固定宽度52px，保证布局稳定性
                    * - 只有左、上、下边框，与右侧输入框形成连续外观
                    * - 左侧圆角，作为整个组合的起始部分
                    * - Flex布局垂直居中，内容水平排列
                    */}
                    <div
                        style={{
                            display: "flex",              // Flex布局，水平排列图标和数字
                            cursor: "pointer",            // 鼠标悬停显示手型，表示可点击
                            alignItems: "center",         // 垂直居中对齐
                            paddingLeft: "8px",           // 左内边距8px
                            paddingRight: "8px",          // 右内边距8px
                            maxWidth: "52px",             // 最大宽度52px
                            minWidth: "52px",             // 最小宽度52px（实际固定宽度）
                            borderTopLeftRadius: "4px",   // 左上圆角4px
                            borderBottomLeftRadius: "4px",// 左下圆角4px
                            borderLeft: "1px solid #3d506c",   // 左边框：深蓝色1px实线
                            borderTop: "1px solid #3d506c",    // 上边框：深蓝色1px实线
                            borderBottom: "1px solid #3d506c", // 下边框：深蓝色1px实线
                            // 注意：故意不设置右边框，与右侧输入框的左边框连接形成整体
                        }}
                        onClick={() => currentValue.name && editing?.dispatch?.("clickVar", currentValue.name)}
                    >
                        <AimOutlined />  {/* 瞄准图标，表示引用/定位功能 */}
                        <span style={{ marginLeft: 4 }}>{currentValue?.count ?? 0}</span>  {/* 引用计数，左边距4px */}
                    </div>

                    {/* 变量名输入框：绑定到表单字段 [name, "name"]
                        * 布局特点：
                        * - flex: 1 自动填充可用空间，与描述框平分Space.Compact的剩余宽度
                        * - margin: 0 移除默认边距，确保与其他元素紧密连接
                        * - 失焦时自动提交表单，实现实时保存
                    */}
                    <Form.Item name={[name, "name"]} style={{ margin: 0, flex: 1 }}>
                        <Input
                            disabled={isDisabled}
                            placeholder={t("tree.vars.name")}  // 国际化占位符文本
                            onBlur={onSubmit}  // 失焦时自动提交表单
                        />
                    </Form.Item>

                    {/* 变量描述输入框：绑定到表单字段 [name, "desc"]
                        * 布局特点：与变量名输入框相同，flex: 1 平分剩余空间
                    */}
                    <Form.Item name={[name, "desc"]} style={{ margin: 0, flex: 1 }}>
                        <Input
                            disabled={isDisabled}
                            placeholder={t("tree.vars.desc")}  // 国际化占位符文本
                            onBlur={onSubmit}  // 失焦时自动提交表单
                        />
                    </Form.Item>
                </Space.Compact>

                {/* 删除按钮：仅在非禁用状态下显示
                    * 布局特点：
                    * - marginBottom: "6px" 向上偏移6px，与输入框视觉对齐
                    * - 点击时移除当前变量并提交表单
                */}
                {!isDisabled && (
                    <MinusCircleOutlined
                        style={{ marginBottom: "6px" }}
                        onClick={() => {
                            onRemove?.(name);  // 调用移除回调
                            form.submit();     // 立即提交表单保存更改
                        }}
                    />
                )}

                {/* 占位符：在禁用状态下保持布局稳定性
                * 宽度20px，与删除按钮图标宽度一致，避免布局跳动
                */}
                {isDisabled && <div style={{ width: 20 }} />}
            </Flex>

            {/* 第二行：类型选择和值编辑器 - 水平布局，元素间距4px */}
            <Flex gap={4}>
                {/* 变量类型选择器：绑定到表单字段 [name, "type"]
                    * 布局特点：
                    * - minWidth: 120px 最小宽度，确保类型选项完整显示
                    * - margin: 0 移除默认边距
                    * - 类型切换时自动重置值，保证数据一致性
                */}
                <Form.Item name={[name, "type"]} style={{ margin: 0 }}>
                    <Select
                        disabled={isDisabled}
                        options={typeOptions}  // 变量类型选项列表
                        style={{ minWidth: 120 }}  // 最小宽度120px
                        onBlur={onSubmit}  // 失焦时自动提交表单
                        onChange={(newType) => {
                            // 类型切换时的值重置逻辑：
                            // 1. 切换到对象变量时，清空值（对象变量值由运行时注入）
                            // 2. 切换到其他类型且当前无值时，设置空字符串作为默认值
                            if (newType === ArgType.OBJECT_VAR) {
                                form.setFieldValue(['vars', name, 'value'], undefined);
                            } else if (!form.getFieldValue(['vars', name, 'value'])) {
                                form.setFieldValue(['vars', name, 'value'], "");
                            }
                        }}
                    />
                </Form.Item>

                {/* 值编辑器容器：根据变量类型动态渲染对应的编辑器
                    * 布局特点：
                    * - flex: 1 自动填充剩余空间，确保编辑器占据最大可用宽度
                    * - 内部调用 renderValueEditor() 根据类型渲染不同的编辑控件
                */}
                <div style={{ flex: 1 }}>
                    {renderValueEditor()}  {/* 动态渲染值编辑器：Input/TextArea/禁用状态等 */}
                </div>
            </Flex>
        </Flex>
    );
};

/**
 * VarSelector 组件 - 变量选择器
 * 
 * 用于选择变量并返回包含 name 和 type 的对象结构
 * 支持从可用变量中选择或手动输入变量名
 */
interface VariableAutoCompleteProps {
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    onBlur?: () => void;
    options: OptionType[];
    onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    filterOption?: (inputValue: string, option?: OptionType) => boolean;
}

const VariableAutoComplete: FC<VariableAutoCompleteProps> = ({
    value,
    onChange,
    disabled,
    placeholder,
    onBlur,
    options,
    onInputKeyDown,
    filterOption
}) => {
    const { t } = useTranslation();
    const { workspace } = useWorkspace(
        useShallow((state) => ({
            workspace: state,
        }))
    );

    // 获取显示值（带类型标签）
    const displayValue = useMemo(() => {
        return getVariableDisplayValue(value, workspace.usingVars, t);
    }, [value, workspace.usingVars, t]);

    return (
        <AutoComplete
            value={displayValue}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            placeholder={placeholder}
            options={options}
            onInputKeyDown={onInputKeyDown}
            filterOption={filterOption}
        />
    );
};

// VarDecl 编辑器组件
interface VarDeclEditorProps {
    value?: VarDecl;
    onChange?: (value: VarDecl) => void;
    onRemove?: () => void;
    disabled?: boolean;
    onBlur?: () => void;
    placeholder?: string;
}

const VarDeclEditor: FC<VarDeclEditorProps> = ({
    value,
    onChange,
    onRemove,
    disabled,
    onBlur,
    placeholder
}) => {
    const { t } = useTranslation();

    const handleChange = (field: keyof VarDecl, newValue: any) => {
        if (onChange) {
            onChange({
                ...value,
                [field]: newValue
            } as VarDecl);
        }
    };

    return (
        <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px', position: 'relative' }}>
            {onRemove && (
                <Button
                    type="text"
                    size="small"
                    icon={<MinusCircleOutlined />}
                    onClick={onRemove}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        color: '#ff4d4f',
                        zIndex: 1
                    }}
                />
            )}
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Input
                        placeholder={t("node.varName", "变量名")}
                        value={value?.name || ''}
                        onChange={(e) => handleChange('name', e.target.value)}
                        disabled={disabled}
                        onBlur={onBlur}
                        style={{ flex: 1 }}
                    />
                    <Select
                        placeholder={t("node.varType", "类型")}
                        value={value?.type || ArgType.CONST_VAR}
                        onChange={(val) => handleChange('type', val)}
                        disabled={disabled}
                        style={{ width: '120px' }}
                        options={[
                            { label: t("node.constVar", "常量"), value: ArgType.CONST_VAR },
                            { label: t("node.objectVar", "变量"), value: ArgType.OBJECT_VAR },
                            { label: t("node.exprVar", "表达式"), value: ArgType.CODE_VAR }
                        ]}
                    />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <Select
                        placeholder={t("node.valueType", "值类型")}
                        value={value?.value_type || ValueType.STRING}
                        onChange={(val) => handleChange('value_type', val)}
                        disabled={disabled}
                        style={{ width: '100px' }}
                        options={[
                            { label: "String", value: ValueType.STRING },
                            { label: "Int", value: ValueType.INT },
                            { label: "Float", value: ValueType.FLOAT },
                            { label: "Bool", value: ValueType.BOOL },
                            { label: "JSON", value: ValueType.JSON }
                        ]}
                    />

                    {value?.type === ArgType.CONST_VAR && (
                        <Input
                            placeholder={t("node.defaultValue", "默认值")}
                            value={String(value?.value || '')}
                            onChange={(e) => handleChange('value', e.target.value)}
                            disabled={disabled}
                            onBlur={onBlur}
                            style={{ flex: 1 }}
                        />
                    )}

                    {value?.type === ArgType.OBJECT_VAR && (
                        <Input
                            placeholder={t("node.selectVariable", "选择变量")}
                            value={String(value?.value || '')}
                            onChange={(e) => handleChange('value', e.target.value)}
                            disabled={disabled}
                            onBlur={onBlur}
                            style={{ flex: 1 }}
                        />
                    )}

                    {value?.type === ArgType.CODE_VAR && (
                        <Input
                            placeholder={t("node.expression", "表达式")}
                            value={String(value?.value || '')}
                            onChange={(e) => handleChange('value', e.target.value)}
                            disabled={disabled}
                            onBlur={onBlur}
                            style={{ flex: 1 }}
                        />
                    )}
                </div>

                <Input
                    placeholder={t("node.description", "描述")}
                    value={value?.desc || ''}
                    onChange={(e) => handleChange('desc', e.target.value)}
                    disabled={disabled}
                    onBlur={onBlur}
                    size="small"
                />

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Switch
                        size="small"
                        checked={value?.optional || false}
                        onChange={(checked) => handleChange('optional', checked)}
                        disabled={disabled}
                    />
                    <span style={{ fontSize: '12px', color: '#666' }}>
                        {t("node.optional", "可选")}
                    </span>
                </div>
            </Space>
        </div>
    );
};



const VarSelector: FC<VarSelectorProps> = ({ value, onChange, disabled, placeholder, onBlur }) => {
    const { t } = useTranslation();
    const { workspace } = useWorkspace(
        useShallow((state) => ({
            workspace: state,
        }))
    );

    // 构建变量选项，包含类型信息
    const varOptions = useMemo(() => {
        const options: Array<{ label: string; value: string; type: string }> = [];
        const filter: Record<string, boolean> = {};

        // 收集节点输入输出变量
        const collect = (node?: NodeData) => {
            if (node) {
                const def = workspace.nodeDefs.get(node.name);
                node.input?.forEach((v, i) => {
                    let desc: string;
                    const inputDef = def.input;
                    if (inputDef && i >= inputDef.length && isVariadic(inputDef, -1)) {
                        const lastDef = inputDef[inputDef.length - 1];
                        desc = typeof lastDef === 'string' ? lastDef : lastDef ? ((lastDef as VarDecl).desc ?? (lastDef as VarDecl).name) : "<unknown>";
                    } else {
                        const currentDef = inputDef?.[i];
                        desc = typeof currentDef === 'string' ? currentDef : currentDef ? ((currentDef as VarDecl).desc ?? (currentDef as VarDecl).name) : "<unknown>";
                    }
                    if (!filter[v.name]) {
                        options.push({
                            label: `${v.name} (${desc})`,
                            value: v.name,
                            type: ArgType.OBJECT_VAR // 节点变量默认为 object 类型
                        });
                        filter[v.name] = true;
                    }
                });
                node.output?.forEach((v, i) => {
                    let desc: string;
                    const outputDef = def.output;
                    if (outputDef && i >= outputDef.length && isVariadic(outputDef, -1)) {
                        const lastDef = outputDef[outputDef.length - 1];
                        desc = typeof lastDef === 'string' ? lastDef : lastDef ? ((lastDef as VarDecl).desc ?? (lastDef as VarDecl).name) : "<unknown>";
                    } else {
                        const currentDef = outputDef?.[i];
                        desc = typeof currentDef === 'string' ? currentDef : currentDef ? ((currentDef as VarDecl).desc ?? (currentDef as VarDecl).name) : "<unknown>";
                    }
                    if (!filter[v.name]) {
                        options.push({
                            label: `${v.name} (${desc})`,
                            value: v.name,
                            type: ArgType.OBJECT_VAR // 节点变量默认为 object 类型
                        });
                        filter[v.name] = true;
                    }
                });
                node.children?.forEach((child) => collect(child));
            }
        };

        // 收集所有可用变量
        if (workspace.usingVars) {
            Object.values(workspace.usingVars).forEach((v) => {
                if (!filter[v.name]) {
                    options.push({
                        label: formatVariableLabel(v.name, v.type, t),
                        value: v.name,
                        type: v.type || ArgType.OBJECT_VAR
                    });
                    filter[v.name] = true;
                }
            });
        } else {
            // 如果没有 usingVars，则收集节点变量
            collect(workspace.editing?.data.root);
        }

        return options;
    }, [workspace.editing, workspace.usingVars, workspace.nodeDefs, t]);

    // 处理选择变化
    const handleChange = (selectedValue: string) => {
        if (!selectedValue) {
            onChange?.(undefined);
            return;
        }

        // 查找选中变量的类型
        const selectedVar = varOptions.find(opt => opt.value === selectedValue);
        if (selectedVar) {
            onChange?.({
                name: selectedValue, // 直接使用选项的 value，已经包含前缀
                type: selectedVar.type
            });
        } else {
            // 手动输入的变量名，默认为 object_var 类型
            onChange?.({
                name: selectedValue,
                type: ArgType.OBJECT_VAR
            });
        }
    };

    // 处理下拉选择事件 - 桥接到 handleChange 以确保选择下拉项也能触发表单更新
    const handleSelect = (selectedValue: string) => {
        handleChange(selectedValue);
    };

    // 显示值 - 兼容字符串和对象类型
    const displayValue = (() => {
        if (!value) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object' && 'name' in value && 'type' in value) {
            // 对于对象类型的 value，显示变量名加类型标识
            return formatVariableLabel(
                value.name,
                value.type,
                t
            );
        }
        return '';
    })();

    return (
        <AutoComplete
            value={displayValue}
            onChange={handleChange}
            onSelect={handleSelect}
            onBlur={onBlur}
            disabled={disabled}
            placeholder={placeholder || t("node.selectVariableOrEnterValue", "选择变量或输入值")}
            options={varOptions.map(opt => ({
                label: opt.label,
                value: opt.value
            }))}
            filterOption={(inputValue, option) => {
                const label = option!.label as string;
                return label.toUpperCase().includes(inputValue.toUpperCase());
            }}
        />
    );
};

/**
* TreeInspector 组件 - 行为树总体信息编辑
* 
* 功能：名称、描述、导出开关、前缀、分组、变量、导入与子树配置
* - 统计变量引用次数（usingCount）用于提示使用情况
*/
/**
 * TreeInspector 组件 - 行为树属性检查器
 * 
 * 布局设计：
 * - 标题区域：padding: 12px 24px，字体大小 18px，字重 600
 * - 内容区域：自动滚动，高度 100%
 * - 表单布局：
 *   - labelCol: { flex: '160px' } - 标签列宽度较宽，适应较长的标签文本
 *   - wrapperCol: { flex: 'auto' } - 输入列自动填充
 *   - labelAlign: "left" - 标签左对齐
 *   - colon: false - 不显示冒号
 * - 变量列表：使用 Form.List 动态渲染，支持添加/删除操作
 * - 间距设计：表单项间距 16px，列表项间距 8px
 */
const TreeInspector: FC = () => {
    const workspace = useWorkspace(
        useShallow((state) => ({
            allFiles: state.allFiles,
            editing: state.editing,
            editingTree: state.editingTree!,
            fileTree: state.fileTree,
            groupDefs: state.groupDefs,
            nodeDefs: state.nodeDefs,
            relative: state.relative,
            open: state.open,
            workdir: state.workdir,
            usingVars: state.usingVars,
        }))
    );
    const { t } = useTranslation();
    const [form] = Form.useForm();

    // 判断当前编辑的文件是否为配置文件
    const isConfigFile = (workspace.editing?.path?.includes('/cfg/') || workspace.editing?.path?.includes('/vars/')) ?? false;

    // using count：统计变量在输入/输出/参数表达式中的使用次数
    const usingCount: Record<string, number> = useMemo(() => {
        const count: Record<string, number> = {};
        const collect = (node: NodeData) => {
            const def = workspace.nodeDefs.get(node.name);
            if (def.input) {
                node.input?.forEach((v) => {
                    count[v.name] = (count[v.name] ?? 0) + 1;
                });
            }
            if (def.output) {
                node.output?.forEach((v) => {
                    count[v.name] = (count[v.name] ?? 0) + 1;
                });
            }
            if (def.args) {
                def.args.forEach((arg, i) => {
                    const argData = node.args?.[i];
                    const expr = argData?.value as string | string[] | { name: string; type: string } | { name: string; type: string }[] | undefined;
                    if (!arg.value_type || !isExprType(arg.value_type) || !expr) {
                        return;
                    }

                    // 处理新的对象结构和旧的字符串格式
                    const extractExprValue = (value: any): string => {
                        if (typeof value === 'string') {
                            return value;
                        } else if (typeof value === 'object' && value !== null && 'name' in value) {
                            return value.name;
                        }
                        return '';
                    };

                    if (Array.isArray(expr)) {
                        expr.forEach((item) => {
                            const exprValue = extractExprValue(item);
                            if (exprValue) {
                                parseExpr(exprValue).forEach((v) => {
                                    count[v] = (count[v] ?? 0) + 1;
                                });
                            }
                        });
                    } else {
                        const exprValue = extractExprValue(expr);
                        if (exprValue) {
                            parseExpr(exprValue).forEach((v) => {
                                count[v] = (count[v] ?? 0) + 1;
                            });
                        }
                    }
                });
            }
            node.children?.forEach(collect);
        };
        collect(workspace.editingTree.root);
        return count;
    }, [workspace.editingTree, workspace.nodeDefs, workspace.usingVars]);

    // auto complete for subtree
    const subtreeOptions = useMemo(() => {
        const options: OptionType[] = [];
        workspace.allFiles.forEach((file) => {
            const value = workspace.relative(file.path);
            const desc = ""; //fileNode.desc ? `(${fileNode.desc})` : "";
            options.push({
                label: `${value}${desc}`,
                value: value,
            });
        });
        options.sort((a, b) => a.value.localeCompare(b.value));
        return options;
    }, [workspace.allFiles, workspace.fileTree]);

    /**
     * 表单数据同步 useEffect
     * 
     * 🎯 作用：当编辑树（editingTree）或变量使用计数（usingCount）发生变化时，
     * 自动将最新的数据同步到表单中，确保表单显示的内容与当前编辑的树保持一致。
     * 
     * 🔄 触发时机：
     * - 切换到不同的行为树文件时
     * - 编辑树的基本信息发生变化时（name、desc、export、prefix、group）
     * - 树的变量定义发生变化时（vars 数组）
     * - 树的导入配置发生变化时（import 数组）
     * - 树的子树配置发生变化时（subtree 数组）
     * - 变量使用计数发生变化时（usingCount 对象）
     * 
     * 📊 数据流向：workspace.editingTree → 表单字段
     * 
     * 🔧 循环引用解决方案：
     * 依赖数组中使用 JSON.stringify() 将复杂对象序列化为字符串，
     * 避免 React 深度比较时出现循环引用警告。
     * 
     * 💡 关键概念：
     * - usingCount: 记录每个变量在当前树中被使用的次数
     * - vars: 当前树定义的变量列表
     * - import: 从其他文件导入的变量配置
     * - subtree: 子树的变量配置
     */
    useEffect(() => {
        // 步骤1: 清空表单所有字段，避免旧数据残留
        form.resetFields();
        
        // 步骤2: 设置树的基本信息字段
        form.setFieldValue("name", workspace.editingTree.name);           // 树名称
        form.setFieldValue("desc", workspace.editingTree.desc);           // 树描述  
        form.setFieldValue("export", workspace.editingTree.export !== false); // 是否导出（默认true）
        form.setFieldValue("prefix", workspace.editingTree.prefix);       // 前缀
        form.setFieldValue("group", workspace.editingTree.group);         // 分组标签数组
        
        // 步骤3: 处理变量定义数组（vars）
        // 将每个变量对象转换为表单需要的格式，并添加使用计数信息
        form.setFieldValue(
            "vars",
            workspace.editingTree.vars.map((v) => ({
                name: v.name,                           // 变量名
                desc: v.desc,                           // 变量描述
                type: v.type,                           // 变量类型（string、number、boolean等）
                value: v.value,                         // 变量默认值
                count: usingCount[v.name] ?? 0,         // 变量在树中的使用次数（用于UI显示）
            }))
        );
        
        // 步骤4: 处理导入配置数组（import）
        // 每个导入项包含路径和该路径下的变量列表
        form.setFieldValue(
            "import",
            workspace.editingTree.import.map((entry) => ({
                path: entry.path,                       // 导入的文件路径
                vars: entry.vars.map((v) => ({          // 该文件中可用的变量列表
                    name: v.name,                       // 变量名
                    desc: v.desc,                       // 变量描述
                    type: v.type,                       // 变量类型
                    value: v.value,                     // 变量默认值
                    count: usingCount[v.name] ?? 0,     // 变量使用计数
                })),
            }))
        );
        
        // 步骤5: 处理子树配置数组（subtree）
        // 每个子树项包含路径和该子树的变量列表
        form.setFieldValue(
            "subtree",
            workspace.editingTree.subtree.map((entry) => ({
                path: entry.path,                       // 子树的文件路径
                vars: entry.vars.map((v) => ({          // 该子树中定义的变量列表
                    name: v.name,                       // 变量名
                    desc: v.desc,                       // 变量描述
                    type: v.type,                       // 变量类型
                    value: v.value,                     // 变量默认值
                    count: usingCount[v.name] ?? 0,     // 变量使用计数（帮助识别活跃变量）
                })),
            }))
        );
        
        // 注意：count 字段的作用是在 UI 中显示每个变量被使用的次数，
        // 帮助用户了解哪些变量是活跃使用的，哪些可能是冗余的
    }, [
        workspace.editingTree,
        usingCount
    ]);

    /**
     * 提交树编辑结果（保存到 workspace）
     * 
     * @param values 表单值（树的基础信息与导入等）
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finish = (values: any) => {
        workspace.editing?.dispatch?.("updateTree", {
            name: values.name,
            desc: values.desc,
            export: values.export,
            prefix: values.prefix,
            group: ((values.group ?? []) as string[]).filter((g) => g).sort((a, b) => a.localeCompare(b)),
            vars: (values.vars as VarDecl[])
                .filter((v) => v && v.name)
                .map((v) => ({
                    name: v.name,
                    desc: v.desc,
                    type: v.type,
                    value: v.value,
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            import: (values.import as ImportDecl[])
                .filter((v) => v && v.path)
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((v) => ({
                    path: v.path,
                    vars: (v.vars ?? []).map((v1) => ({
                        name: v1.name,
                        desc: v1.desc,
                        type: v1.type,
                        value: v1.value
                    })),
                })),
        } as EditTree);
    };

    return (
        <>
            {/* 标题区域 - 固定高度，统一样式 */}
            <div style={{ padding: "12px 24px" }}>
                <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("tree.overview")}</span>
            </div>

            {/* 内容区域 - 可滚动，自适应高度 */}
            <div
                className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
                style={{ overflow: "auto", height: "100%" }}
            >
                {/* 主表单 - 树属性编辑 */}
                <Form
                    form={form}
                    labelCol={{ flex: '160px' }}  // 标签列宽度：160px（比节点检查器更宽）
                    wrapperCol={{ flex: 'auto' }}  // 输入列：自动填充剩余空间
                    labelAlign="left"  // 标签左对齐
                    colon={false}  // 不显示冒号
                    onFinish={finish}
                >
                    <>
                        <Form.Item name="name" label={t("tree.name")}>
                            <Input disabled={true} />
                        </Form.Item>
                        <Form.Item name="desc" label={t("tree.desc")}>
                            <TextArea autoSize onBlur={form.submit} disabled={isConfigFile} />
                        </Form.Item>
                        <Form.Item name="prefix" label={t("tree.prefix")}>
                            <Input onBlur={form.submit} disabled={isConfigFile} />
                        </Form.Item>
                        <Form.Item name="export" label={t("tree.export")} valuePropName="checked">
                            <Switch onChange={() => form.submit()} disabled={isConfigFile} />
                        </Form.Item>
                    </>
                    {workspace.groupDefs.length > 0 && (
                        <>
                            <Divider orientation="left">
                                <h4>{t("tree.group")}</h4>
                            </Divider>
                            <Form.Item name="group">
                                <Select
                                    mode="multiple"
                                    suffixIcon={null}
                                    onChange={form.submit}
                                    placeholder={t("tree.group.placeholder")}
                                    options={workspace.groupDefs.map((g) => ({ label: g, value: g }))}
                                    disabled={isConfigFile}
                                />
                            </Form.Item>
                        </>
                    )}
                    <>
                        <Divider orientation="left">
                            <h4>{t("tree.vars")}</h4>
                        </Divider>
                        {(workspace.editing?.path?.includes('/cfg/') || workspace.editing?.path?.includes('/vars/')) && (
                            <div style={{
                                padding: '8px 12px',
                                backgroundColor: '#fff7e6',
                                border: '1px solid #ffd591',
                                borderRadius: '4px',
                                marginBottom: '8px',
                                fontSize: '12px',
                                color: '#d46b08'
                            }}>
                                ⚠️ {t("tree.vars.configFileReadOnly", "Configuration file variables are read-only")}
                            </div>
                        )}
                        <Form.List name="vars">
                            {(fields, { add, remove }, { errors }) => (
                                <div style={{ display: "flex", flexDirection: "column", rowGap: 0 }}>
                                    {fields.map((item) => (
                                        <Form.Item
                                            key={item.key}
                                            name={item.name}
                                            validateTrigger={["onChange", "onBlur"]}
                                            style={{ marginBottom: 2 }}
                                            rules={[
                                                {
                                                    validator(_, value: VarItem) {
                                                        if (!value.name || !isValidVariableName(value.name)) {
                                                            return Promise.reject(new Error(t("tree.vars.invalidName")));
                                                        }
                                                        if (!value.desc) {
                                                            return Promise.reject(
                                                                new Error(t("fieldRequired", { field: t("tree.vars.desc") }))
                                                            );
                                                        }
                                                        return Promise.resolve();
                                                    },
                                                },
                                            ]}
                                        >
                                            <VarDeclItem name={item.name} onRemove={remove} />
                                        </Form.Item>
                                    ))}
                                    <Form.Item
                                        style={{
                                            marginRight: fields.length === 0 ? undefined : "18px",
                                            marginTop: 4,
                                            alignItems: "end",
                                        }}
                                    >
                                        <Button
                                            type="dashed"
                                            onClick={() => {
                                                add({});
                                            }}
                                            style={{ width: "100%" }}
                                            icon={<PlusOutlined />}
                                            disabled={isConfigFile}
                                        >
                                            {t("add")}
                                        </Button>
                                        <Form.ErrorList errors={errors} />
                                    </Form.Item>
                                </div>
                            )}
                        </Form.List>
                    </>
                    {workspace.editingTree.subtree.length > 0 && (
                        <>
                            <Divider orientation="left">
                                <h4>{t("tree.vars.subtree")}</h4>
                            </Divider>
                            <Form.List name="subtree">
                                {(items) => (
                                    <div style={{ display: "flex", flexDirection: "column", rowGap: 4 }}>
                                        {items.map((item) => (
                                            <Space.Compact
                                                key={item.key}
                                                className="b3-inspector-import-item"
                                                direction="vertical"
                                                style={{ marginBottom: 5 }}
                                            >
                                                <Flex gap={4} style={{ width: "100%" }}>
                                                    <Form.Item
                                                        name={[item.name, "path"]}
                                                        style={{ width: "100%", maxWidth: 300, marginBottom: 2 }}
                                                    >
                                                        <Select
                                                            disabled={true}
                                                            showSearch
                                                            options={subtreeOptions}
                                                            onBlur={form.submit}
                                                            onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                                                            filterOption={(value, option) => {
                                                                const label = option!.label as string;
                                                                return label.toUpperCase().includes(value.toUpperCase());
                                                            }}
                                                        />
                                                    </Form.Item>
                                                    {!isConfigFile && (
                                                        <FormOutlined
                                                            onClick={() => {
                                                                const path = workspace.editingTree.subtree[item.name].path;
                                                                workspace.open(`${workspace.workdir}/${path}`);
                                                            }}
                                                        />
                                                    )}
                                                    {isConfigFile && <div style={{ width: 20 }} />}
                                                </Flex>
                                                <Form.List name={[item.name, "vars"]}>
                                                    {(vars) => (
                                                        <div style={{ display: "flex", flexDirection: "column", rowGap: 0 }}>
                                                            {vars.map((v) => (
                                                                <Form.Item key={v.key} name={v.name} style={{ marginBottom: 2 }}>
                                                                    <VarDeclItem name={v.name} disabled={true} />
                                                                </Form.Item>
                                                            ))}
                                                        </div>
                                                    )}
                                                </Form.List>
                                            </Space.Compact>
                                        ))}
                                    </div>
                                )}
                            </Form.List>
                        </>
                    )}
                    <>
                        <Divider orientation="left">
                            <h4>{t("tree.vars.imports")}</h4>
                        </Divider>
                        <Form.List name="import">
                            {(items, { add, remove }, { errors }) => (
                                <div style={{ display: "flex", flexDirection: "column", rowGap: 4 }}>
                                    {items.map((item) => (
                                        <Space.Compact
                                            key={item.key}
                                            className="b3-inspector-import-item"
                                            direction="vertical"
                                            style={{ marginBottom: 5 }}
                                        >
                                            <Flex gap={4} style={{ width: "100%" }}>
                                                <Form.Item
                                                    name={[item.name, "path"]}
                                                    style={{ width: "100%", maxWidth: 300, marginBottom: 2 }}
                                                >
                                                    <Select
                                                        showSearch
                                                        options={subtreeOptions}
                                                        onBlur={form.submit}
                                                        onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                                                        filterOption={(value, option) => {
                                                            const label = option!.label as string;
                                                            return label.toUpperCase().includes(value.toUpperCase());
                                                        }}
                                                        disabled={isConfigFile}
                                                    />
                                                </Form.Item>
                                                {!isConfigFile && (
                                                    <MinusCircleOutlined
                                                        style={{ marginBottom: "6px" }}
                                                        onClick={() => {
                                                            remove(item.name);
                                                            form.submit();
                                                        }}
                                                    />
                                                )}
                                                {isConfigFile && <div style={{ width: 20 }} />}
                                            </Flex>
                                            <Form.List name={[item.name, "vars"]}>
                                                {(vars) => (
                                                    <div style={{ display: "flex", flexDirection: "column", rowGap: 0 }}>
                                                        {vars.map((v) => (
                                                            <Form.Item key={v.key} name={v.name} style={{ marginBottom: 2 }}>
                                                                <VarDeclItem name={v.name} disabled={true} />
                                                            </Form.Item>
                                                        ))}
                                                    </div>
                                                )}
                                            </Form.List>
                                        </Space.Compact>
                                    ))}
                                    <Form.Item
                                        style={{
                                            marginRight: items.length === 0 ? undefined : "18px",
                                            alignItems: "end",
                                        }}
                                    >
                                        <Button
                                            type="dashed"
                                            onClick={() => {
                                                add({});
                                            }}
                                            style={{ width: "100%" }}
                                            icon={<PlusOutlined />}
                                            disabled={isConfigFile}
                                        >
                                            {t("add")}
                                        </Button>
                                        <Form.ErrorList errors={errors} />
                                    </Form.Item>
                                </div>
                            )}
                        </Form.List>
                    </>
                </Form>
            </div>
        </>
    );
};

/**
 * 参数校验函数
 * 
 * 检查节点参数值是否满足定义要求（类型、可选项、数组、表达式等）
 * 
 * @param node 当前节点数据
 * @param arg 参数定义
 * @param value 参数值
 * @param usingVars 可用变量集合（用于表达式校验）
 * @returns 是否校验通过
 */
const validateArg = (
    node: NodeData,
    arg: NodeArg,
    value: unknown,
    usingVars: Record<string, VarDecl> | null
) => {
    logDebug("validateArg", `Validating arg "${arg.name}" with value:`, value);
    logDebug("validateArg", "usingVars:", usingVars ? Object.keys(usingVars) : 'null');

    const type = getNodeArgValueType(arg);
    const required = !isNodeArgOptional(arg);

    // 统一处理两控件结构：数组与基础类型
    if (isNodeArgArray(arg)) {
        let list: unknown[] = Array.isArray((value as any)?.value)
            ? (value as any).value
            : Array.isArray(value) ? (value as any) : [];

        list = (list as any[]).map((item) => {
            if (item && typeof item === 'object') {
                if ('name' in item) {
                    return (item as any).name;
                } else if ('type' in item && 'value' in item) {
                    const vType = (item as any).type as ArgType;
                    if (vType === ArgType.CONST_VAR) {
                        let out: unknown = (item as any).value;
                        if (isJsonType(type)) {
                            if (out === "null") out = null;
                            else if (typeof out === "string") {
                                try { out = JSON.parse(out as string); } catch { /* keep string */ }
                            }
                        }
                        return out;
                    } else {
                        return (item as any).value; // 变量名字符串
                    }
                }
            }
            return item;
        });
        value = list;
    } else {
        // 基础类型：解包 {name,type} 或 {type,value}
        if (typeof value === 'object' && value !== null) {
            if ('name' in (value as any)) {
                value = (value as any).name;
                logDebug("validateArg", `Object value detected, extracted name: "${value}"`);
            } else if ('type' in (value as any) && 'value' in (value as any)) {
                const vType = (value as any).type as ArgType;
                if (vType === ArgType.CONST_VAR) {
                    let out: unknown = (value as any).value;
                    if (isJsonType(type)) {
                        if (out === "null") out = null;
                        else if (typeof out === "string") {
                            try { out = JSON.parse(out as string); } catch { /* keep string */ }
                        }
                    }
                    value = out;
                } else {
                    value = (value as any).value; // 变量名字符串
                }
            }
        }

        if (isExprType(type) && value) {
            const exprValue = value as string;
            logDebug("validateArg", `Expression value: "${exprValue}"`);

            const parsedVars = parseExpr(exprValue);
            logDebug("validateArg", "Parsed variables from expression:", parsedVars);

            for (const v of parsedVars) {
                logDebug("validateArg", `Checking variable "${v}"`);
                if (!isVariableExists(v, usingVars)) {
                    logDebug("validateArg", `Variable "${v}" not found, rejecting`);
                    return Promise.reject(new Error(i18n.t("node.undefinedVariable", { variable: v })));
                } else {
                    logDebug("validateArg", `Variable "${v}" found`);
                }
            }
            if (useWorkspace.getState().settings.checkExpr) {
                try {
                    if (!new ExpressionEvaluator(exprValue).dryRun()) {
                        return Promise.reject(new Error(i18n.t("node.invalidExpression")));
                    }
                } catch (e) {
                    console.error(e);
                    return Promise.reject(new Error(i18n.t("node.invalidExpression")));
                }
            }
        }

        if (value && isJsonType(type)) {
            try {
                if (value !== "null") {
                    JSON.parse(value as string);
                }
            } catch (e) {
                return Promise.reject(new Error(i18n.t("node.invalidValue")));
            }
        } else if (value === null && !required) {
            value = undefined;
        }
    }

    if (!checkNodeArgValue(node, arg, value, true)) {
        return Promise.reject(new Error(i18n.t("node.invalidValue")));
    }
    return Promise.resolve();
};

/**
 * NodeInspector 组件 - 节点属性检查器
 * 
 * 布局设计：
 * - 标题区域：padding: 12px 24px，显示节点描述
 * - 内容区域：自动滚动，高度 100%
 * - 表单布局：
 *   - labelCol: { flex: '72px' } - 标签列宽度紧凑，适应节点属性标签
 *   - wrapperCol: { flex: 'auto' } - 输入列自动填充
 *   - labelAlign: "left" - 标签左对齐
 *   - colon: false - 不显示冒号
 * - 参数区域：使用 VarEditor 组件，支持多种类型的值编辑
 * - 变量区域：只读显示，使用特殊样式区分
 * - 间距设计：表单项间距 16px，数组项间距 8px
 */
const NodeInspector: FC = () => {
    const workspace = useWorkspace(
        useShallow((state) => ({
            allFiles: state.allFiles,
            editing: state.editing,
            editingNode: state.editingNode!,
            fileTree: state.fileTree,
            groupDefs: state.groupDefs,
            nodeDefs: state.nodeDefs,
            usingGroups: state.usingGroups,
            usingVars: state.usingVars,
            onEditingNode: state.onEditingNode,
            relative: state.relative,
        }))
    );

    const { t } = useTranslation();
    const [form] = Form.useForm();

    const validateFieldsLater = useDebounceCallback(
        () => form.validateFields({ recursive: true }),
        100
    );

    const submit = () => {
        if (form.isFieldsValidating()) {
            setTimeout(() => {
                submit();
            }, 10);
            return;
        }
        if (form.getFieldsError().some((e) => e.errors.length > 0)) {
            const data = workspace.editingNode.data;
            const editor = workspace.editing!;
            const name = `${editor.data.prefix}${data.id} ${data.name}`;
            message.error(t("node.editFailed", { name }));
        }
        form.submit();
    };

    // set form values
    useEffect(() => {
        const data = workspace.editingNode.data;
        const def = workspace.nodeDefs.get(workspace.editingNode.data.name);
        form.resetFields();
        form.setFieldValue("id", workspace.editingNode.prefix + data.id);
        form.setFieldValue("name", data.name);
        form.setFieldValue("type", def.type);
        form.setFieldValue("desc", data.desc || def.desc);
        form.setFieldValue("debug", data.debug);
        form.setFieldValue("disabled", data.disabled);
        form.setFieldValue("path", data.path);
        form.setFieldValue(
            "group",
            def.group?.map((g) => ({ label: g, value: g }))
        );
        if (def.children === undefined || def.children === -1) {
            form.setFieldValue("children", t("node.children.unlimited"));
        } else {
            form.setFieldValue("children", def.children);
        }
        def.args?.forEach((arg, i) => {
            const baseType = getNodeArgValueType(arg);
            const argValue = data.args?.[i];
            const fieldPath = ["args", i];

            if (isNodeArgArray(arg)) {
                const arr = Array.isArray(argValue) ? argValue : [];
                const normalized = arr.map((item) => {
                    if (item && typeof item === 'object' && 'name' in item && 'type' in item) {
                        return { type: (item as any).type as ArgType, value: (item as any).name };
                    } else {
                        if (isJsonType(baseType)) {
                            return { type: ArgType.CONST_VAR, value: item === null ? "null" : JSON.stringify(item ?? undefined, null, 2) };
                        }
                        return { type: ArgType.CONST_VAR, value: item ?? undefined };
                    }
                });
                form.setFieldValue(fieldPath, { value: normalized });
            } else if (isJsonType(baseType)) {
                form.setFieldValue(
                    fieldPath,
                    { type: ArgType.CONST_VAR, value: argValue === null ? "null" : JSON.stringify(argValue ?? arg.default, null, 2) }
                );
            } else if (isExprType(baseType)) {
                form.setFieldValue(
                    fieldPath,
                    { type: ArgType.CODE_VAR, value: typeof argValue === "string" ? argValue : (typeof arg.default === "string" ? arg.default : "") }
                );
            } else {
                if (argValue && typeof argValue === 'object' && 'name' in argValue && 'type' in argValue) {
                    form.setFieldValue(fieldPath, { type: (argValue as any).type as ArgType, value: (argValue as any).name });
                } else {
                    form.setFieldValue(fieldPath, { type: ArgType.CONST_VAR, value: argValue ?? arg.default });
                }
            }
        });
        // 设置 input 字段值 - 现在支持 VarDecl 格式
        if (data.input) {
            data.input.forEach((varDecl, i) => {
                form.setFieldValue(`input.${i}`, varDecl);
            });
        }

        // 设置 output 字段值 - 现在支持 VarDecl 格式
        if (data.output) {
            data.output.forEach((varDecl, i) => {
                form.setFieldValue(`output.${i}`, varDecl);
            });
        }

        // 设置 args 字段值 - 现在支持 VarDecl 格式
        if (data.args) {
            data.args.forEach((varDecl, i) => {
                form.setFieldValue(`args.${i}`, varDecl);
            });
        }
        validateFieldsLater();
    }, [workspace.editingNode]);

    // auto complete for node
    const nodeOptions = useMemo(() => {
        const options: OptionType[] = [];
        workspace.nodeDefs.forEach((e) => {
            options.push({ label: `${e.name}(${e.desc})`, value: e.name });
        });
        return options;
    }, [workspace.nodeDefs]);

    // auto complete for input and output
    const inoutVarOptions = useMemo(() => {
        const options: OptionType[] = [];
        const filter: Record<string, boolean> = {};
        const collect = (node?: NodeData) => {
            if (node) {
                const def = workspace.nodeDefs.get(node.name);
                node.input?.forEach((v, i) => {
                    let desc: string;
                    const inputDef = def.input;
                    if (inputDef && i >= inputDef.length && isVariadic(inputDef, -1)) {
                        const lastDef = inputDef[inputDef.length - 1];
                        desc = (typeof lastDef === 'string' ? lastDef : lastDef ? (lastDef as VarDecl).desc ?? (lastDef as VarDecl).name : undefined) ?? "<unknown>";
                    } else {
                        const currentDef = inputDef?.[i];
                        desc = (typeof currentDef === 'string' ? currentDef : currentDef ? (currentDef as VarDecl).desc ?? (currentDef as VarDecl).name : undefined) ?? "<unknown>";
                    }
                    if (!filter[v.name]) {
                        options.push({ label: `${v.name}(${desc})`, value: v.name });
                        filter[v.name] = true;
                    }
                });
                node.output?.forEach((v, i) => {
                    let desc: string;
                    const outputDef = def.output;
                    if (outputDef && i >= outputDef.length && isVariadic(outputDef, -1)) {
                        const lastDef = outputDef[outputDef.length - 1];
                        desc = (typeof lastDef === 'string' ? lastDef : lastDef ? (lastDef as VarDecl).desc ?? (lastDef as VarDecl).name : undefined) ?? "<unknown>";
                    } else {
                        const currentDef = outputDef?.[i];
                        desc = (typeof currentDef === 'string' ? currentDef : currentDef ? (currentDef as VarDecl).desc ?? (currentDef as VarDecl).name : undefined) ?? "<unknown>";
                    }
                    if (!filter[v.name]) {
                        options.push({ label: `${v.name}(${desc})`, value: v.name });
                        filter[v.name] = true;
                    }
                });
                node.children?.forEach((child) => collect(child));
            }
        };
        if (workspace.usingVars) {
            Object.values(workspace.usingVars).forEach((v) => {
                if (!filter[v.name]) {
                    options.push({
                        label: formatVariableLabel(v.name, v.type, t),
                        value: v.name
                    });
                    filter[v.name] = true;
                }
            });
        } else {
            collect(workspace.editing?.data.root);
        }
        return options;
    }, [workspace.editing, workspace.usingVars, t]);

    // auto complete for subtree
    const subtreeOptions = useMemo(() => {
        const options: OptionType[] = [];
        workspace.allFiles.forEach((file) => {
            const value = workspace.relative(file.path);
            const desc = ""; //fileNode.desc ? `(${fileNode.desc})` : "";
            options.push({
                label: `${value}${desc}`,
                value: value,
            });
        });
        options.sort((a, b) => a.value.localeCompare(b.value));
        return options;
    }, [workspace.allFiles, workspace.fileTree]);

    const editingNode = workspace.editingNode;
    const def = workspace.nodeDefs.get(editingNode.data.name);
    const disabled = editingNode.disabled;

    // update value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finish = (values: any) => {
        const data = {} as NodeData;
        data.id = editingNode.data.id;
        data.name = values.name;
        data.debug = values.debug || undefined;
        data.disabled = values.disabled || undefined;
        data.desc = values.desc && values.desc !== def.desc ? values.desc : undefined;
        data.path = values.path || undefined;

        // 处理 def.args 参数（如 Cmp 节点的 left_value、right_value）
        if (def?.args && def.args.length > 0) {
            const nodeArgs: unknown[] = [];
            def.args.forEach((argDef, i) => {
                const argValue = values.args?.[i];
                const baseType = getNodeArgValueType(argDef);
                if (isNodeArgArray(argDef)) {
                    const list = Array.isArray((argValue as any)?.value)
                        ? (argValue as any).value
                        : Array.isArray(argValue) ? (argValue as any) : [];
                    const normalized = (list as any[]).map((item) => {
                        if (item && typeof item === 'object' && 'type' in item && 'value' in item) {
                            switch ((item as any).type as ArgType) {
                                case ArgType.CONST_VAR: {
                                    let out: unknown = (item as any).value;
                                    if (isJsonType(baseType)) {
                                        if (out === "null") out = null;
                                        else if (typeof out === "string") {
                                            try { out = JSON.parse(out as string); } catch { /* keep string */ }
                                        }
                                    }
                                    return out;
                                }
                                case ArgType.OBJECT_VAR:
                                case ArgType.CFG_VAR:
                                case ArgType.CODE_VAR:
                                    return { name: (item as any).value as string, type: (item as any).type as ArgType };
                                default:
                                    return (item as any).value;
                            }
                        } else {
                            // 兼容旧的纯值数组项
                            if (isJsonType(baseType) && typeof item === "string") {
                                if (item === "null") return null;
                                try { return JSON.parse(item); } catch { return item; }
                            }
                            return item;
                        }
                    });
                    nodeArgs[i] = normalized;
                } else if (argValue && typeof argValue === 'object' && 'type' in argValue && 'value' in argValue) {
                    const { type, value } = argValue as { type: ArgType; value: unknown };
                    switch (type) {
                        case ArgType.CONST_VAR: {
                            let out: unknown = value;
                            if (isJsonType(baseType)) {
                                if (out === "null") out = null;
                                else if (typeof out === "string") {
                                    try { out = JSON.parse(out as string); } catch { /* keep string */ }
                                }
                            }
                            nodeArgs[i] = out;
                            break;
                        }
                        case ArgType.OBJECT_VAR:
                        case ArgType.CFG_VAR:
                        case ArgType.CODE_VAR:
                        case ArgType.JSON_VAR:
                            nodeArgs[i] = { name: value as string, type };
                            break;
                        default:
                            nodeArgs[i] = value;
                    }
                } else {
                    // 兼容原有格式
                    nodeArgs[i] = argValue;
                }
            });
            (data as any).args = nodeArgs;
        }

        // 处理 data.args - VarDecl 格式（用于节点的输入输出参数）
        const argsArray: VarDecl[] = [];
        let argIndex = 0;
        while (values[`args.${argIndex}`]) {
            const varDecl = values[`args.${argIndex}`] as VarDecl;
            if (varDecl && varDecl.name) {
                argsArray.push(varDecl);
            }
            argIndex++;
        }
        if (argsArray.length > 0) {
            (data as any).args = argsArray;
        }

        // 处理 input - 现在使用 VarDecl 格式
        const inputArray: VarDecl[] = [];
        let inputIndex = 0;
        while (values[`input.${inputIndex}`]) {
            const varDecl = values[`input.${inputIndex}`] as VarDecl;
            if (varDecl && varDecl.name) {
                inputArray.push(varDecl);
            }
            inputIndex++;
        }
        data.input = inputArray.length > 0 ? inputArray : undefined;

        // 处理 output - 现在使用 VarDecl 格式
        const outputArray: VarDecl[] = [];
        let outputIndex = 0;
        while (values[`output.${outputIndex}`]) {
            const varDecl = values[`output.${outputIndex}`] as VarDecl;
            if (varDecl && varDecl.name) {
                outputArray.push(varDecl);
            }
            outputIndex++;
        }
        data.output = outputArray.length > 0 ? outputArray : undefined;

        workspace.editing?.dispatch?.("updateNode", {
            data: data,
        } as EditNode);
    };

    // change node def
    const changeNodeDef = (newname: string) => {
        if (editingNode.data.name !== newname) {
            workspace.onEditingNode({
                data: {
                    id: editingNode.data.id,
                    name: workspace.nodeDefs.get(newname)?.name ?? newname,
                    desc: editingNode.data.desc,
                    debug: editingNode.data.debug,
                    disabled: editingNode.data.disabled,
                },
                prefix: editingNode.prefix,
                disabled: editingNode.disabled,
            });
            finish(form.getFieldsValue());
        } else {
            submit();
        }
    };

    const changeSubtree = () => {
        if (form.getFieldValue("path") !== editingNode.data.path) {
            finish(form.getFieldsValue());
        } else {
            submit();
        }
    };

    return (
        <>
            {/* 标题区域 - 显示节点描述，固定高度 */}
            <div style={{ padding: "12px 24px" }}>
                <span style={{ fontSize: "18px", fontWeight: "600" }}>{def.desc}</span>
            </div>

            {/* 内容区域：滚动容器，用于承载表单与节点详情
       * 样式说明：
       * - 高度 100%，占满剩余空间
       * - overflow: auto，内容超出时自动出现滚动条
       * - 非 macOS 平台额外追加 b3-overflow 类，用于平台差异化滚动条样式
       */}
            <div
                className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
                style={{ overflow: "auto", height: "100%" }}
            >
                {/* 主表单 - 节点属性编辑 */}
                <Form
                    form={form}
                    // 标签列宽度固定 72px，保证标签区域紧凑且对齐，适配节点属性编辑场景
                    labelCol={{ flex: '72px' }}
                    // 输入列自动填充剩余空间，确保输入控件在不同宽度面板下都能充分利用可用宽度
                    wrapperCol={{ flex: 'auto' }}
                    // 标签左对齐，与整体表单视觉保持一致，方便用户纵向扫读
                    labelAlign="left"
                    // 不显示冒号，减少视觉噪音，保持简洁风格
                    colon={false}
                    // 表单校验通过后触发 finish 回调，用于保存节点数据到工作区
                    onFinish={finish}
                >
                    <Form.Item name="id" label={t("node.id")}>
                        <Input disabled={true} />
                    </Form.Item>
                    <Form.Item name="type" label={t("node.type")}>
                        <Input disabled={true} />
                    </Form.Item>
                    {workspace.groupDefs.length > 0 && def.group?.length && (
                        <Form.Item
                            name="group"
                            label={t("node.group")}
                            rules={[
                                {
                                    validator() {
                                        if (def.group && !def.group.some((g) => workspace.usingGroups?.[g])) {
                                            return Promise.reject(
                                                new Error(t("node.groupNotEnabled", { group: def.group }))
                                            );
                                        }
                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <Select
                                style={{ fontSize: "13px" }}
                                mode="multiple"
                                suffixIcon={null}
                                disabled={true}
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="children"
                        label={t("node.children")}
                        rules={[
                            {
                                validator() {
                                    if (!isValidChildren(editingNode.data)) {
                                        return Promise.reject(new Error(t("node.invalidChildren")));
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >

                        <Input disabled={true} />
                    </Form.Item>
                    <Form.Item
                        label={t("node.name")}
                        name="name"
                        rules={[
                            {
                                validator() {
                                    if (!workspace.nodeDefs.has(editingNode.data.name)) {
                                        return Promise.reject(
                                            new Error(t("node.notFound", { name: editingNode.data.name }))
                                        );
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        <AutoComplete
                            disabled={disabled}
                            options={nodeOptions}
                            onBlur={() => changeNodeDef(form.getFieldValue("name"))}
                            onSelect={changeNodeDef}
                            onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                            filterOption={(inputValue: string, option?: OptionType) => {
                                const label = option!.label as string;
                                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="desc" label={t("node.desc")}>
                        <TextArea autoSize disabled={disabled} onBlur={submit} />
                    </Form.Item>
                    <Form.Item label={t("node.debug")} name="debug" valuePropName="checked">
                        <Switch disabled={disabled && !editingNode.data.path} onChange={submit} />
                    </Form.Item>
                    <Form.Item label={t("node.disabled")} name="disabled" valuePropName="checked">
                        <Switch disabled={disabled && !editingNode.data.path} onChange={submit} />
                    </Form.Item>
                    <Form.Item label={t("node.subtree")} name="path">
                        <AutoComplete
                            disabled={disabled && !editingNode.subtreeEditable}
                            options={subtreeOptions}
                            onBlur={changeSubtree}
                            onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                            filterOption={(inputValue: string, option?: OptionType) => {
                                const label = option!.label as string;
                                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
                            }}
                        />
                    </Form.Item>
                    <Markdown className="b3-markdown">{def.doc}</Markdown>
                    <NodeInputParams
                        inputs={def.input || []}
                        readonly={true}
                        disabled={disabled}
                        title={t("node.inputVariable")}
                    />
                    <NodeArguments
                        args={def.args || []}
                        editingNode={editingNode}
                        disabled={disabled}
                        title={t("node.args")}
                        showDivider={true}
                        usingVars={workspace.usingVars}
                        validateArg={validateArg}
                        onBlur={submit}
                    />
                    <NodeOutputParams
                        inputs={def.output || []}
                        outputs={def.output || []}
                        readonly={true}
                        disabled={disabled}
                        title={t("node.outputVariable")}
                    />
                </Form>
                {disabled && (
                    <Flex style={{ paddingTop: "30px" }}>
                        <Button
                            type="primary"
                            style={{ width: "100%" }}
                            icon={<EditOutlined />}
                            onClick={() => workspace.editing?.dispatch?.("editSubtree")}
                        >
                            {t("editSubtree")}
                        </Button>
                    </Flex>
                )}
            </div>
        </>
    );
};

/**
 * NodeDefInspector 组件 - 节点定义文档查看
 * 
 * 展示节点的输入/输出/参数说明与 Markdown 文档
 */
/**
 * NodeDefInspector 组件 - 节点定义检查器
 * 
 * 布局设计：
 * - 标题区域：padding: 12px 24px，显示节点定义名称
 * - 内容区域：自动滚动，高度 100%
 * - 表单布局：
 *   - labelCol: { flex: '72px' } - 标签列宽度与 NodeInspector 保持一致
 *   - wrapperCol: { flex: 'auto' } - 输入列自动填充
 *   - labelAlign: "left" - 标签左对齐
 *   - colon: false - 不显示冒号
 * - 只读显示：所有字段均为只读，用于查看节点定义信息
 * - 分组显示：参数、输入变量、输出变量分别展示
 * - 间距设计：与 NodeInspector 保持一致的视觉风格
 */
const NodeDefInspector: FC = () => {
    const workspace = useWorkspace(
        useShallow((state) => ({
            editingNodeDef: state.editingNodeDef!,
            groupDefs: state.groupDefs,
        }))
    );
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const def = workspace.editingNodeDef.data;

    // set form values
    useEffect(() => {
        form.resetFields();
        form.setFieldValue("name", def.name);
        form.setFieldValue("type", def.type);
        form.setFieldValue("desc", def.desc);
        form.setFieldValue("doc", def.doc);
        form.setFieldValue(
            "group",
            def.group?.map((g) => ({ label: g, value: g }))
        );
        if (def.children === undefined || def.children === -1) {
            form.setFieldValue("children", t("node.children.unlimited"));
        } else {
            form.setFieldValue("children", def.children);
        }
        def.input?.forEach((v, i) => {
            // v is always VarDecl type
            form.setFieldValue(`input.${i}.name`, v.name);
        });
        def.output?.forEach((v, i) => {
            // v is always VarDecl type
            form.setFieldValue(`output.${i}.name`, v.name);
        });
        def.args?.forEach((v, i) => {
            form.setFieldValue(`args.${i}.value_type`, v.value_type.replaceAll("?", ""));
        });
    }, [workspace.editingNodeDef]);
    return (
        <>
            <div style={{ padding: "12px 24px" }}>
                <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("nodeDefinition")}</span>
            </div>
            <div
                className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
                style={{ overflow: "auto", height: "100%" }}
            >
                <Form
                    form={form}
                    labelCol={{ flex: '72px' }}
                    wrapperCol={{ flex: 'auto' }}
                    labelAlign="left"
                    colon={false}
                // onFinish={finish}
                >
                    <Form.Item name="name" label={t("node.name")}>
                        <Input disabled={true} />
                    </Form.Item>
                    <Form.Item name="type" label={t("node.type")}>
                        <Input disabled={true} />
                    </Form.Item>
                    {workspace.groupDefs.length > 0 && def.group?.length && (
                        <Form.Item name="group" label={t("node.group")}>
                            <Select
                                style={{ fontSize: "13px" }}
                                mode="multiple"
                                suffixIcon={null}
                                disabled={true}
                            />
                        </Form.Item>
                    )}
                    <Form.Item name="children" label={t("node.children")}>
                        <Input disabled={true} />
                    </Form.Item>
                    <Form.Item name="desc" label={t("node.desc")}>
                        <TextArea autoSize disabled={true} />
                    </Form.Item>
                    <Markdown className="b3-markdown">{def.doc}</Markdown>
                    {def.input && def.input.length > 0 && (
                        <>
                            <Divider orientation="left">
                                <h4>{t("node.inputVariable")}</h4>
                            </Divider>
                            {def.input.map((v, i) => {
                                const varDecl = typeof v === 'string' ? parseStringToVarDecl(v) : v;
                                const required = !varDecl.optional;
                                return (
                                    <Form.Item
                                        label={`[${i}]`}
                                        name={`input.${i}.name`}
                                        key={`input.${i}.name`}
                                        required={required}
                                    >
                                        <Input disabled={true} />
                                    </Form.Item>
                                );
                            })}
                        </>
                    )}
                    {def.args && def.args.length > 0 && (
                        <>
                            <Divider orientation="left">
                                <h4>{t("node.args")}</h4>
                            </Divider>
                            {def.args.map((v, i) => {
                                const required = v.value_type.indexOf("?") === -1;
                                return (
                                    <Form.Item
                                        name={`args.${i}.value_type`}
                                        label={v.desc}
                                        key={`args.${i}.value_type`}
                                        rules={[{ required }]}
                                    >
                                        <Select disabled={true}>
                                            {["float", "int", "string", "code", "boolean"].map((value) => {
                                                return (
                                                    <Select.Option key={value} value={value}>
                                                        {value}
                                                    </Select.Option>
                                                );
                                            })}
                                        </Select>
                                    </Form.Item>
                                );
                            })}
                        </>
                    )}
                    {def.output && def.output.length > 0 && (
                        <>
                            <Divider orientation="left">
                                <h4>{t("node.outputVariable")}</h4>
                            </Divider>
                            {def.output.map((v, i) => {
                                const varDecl = typeof v === 'string' ? parseStringToVarDecl(v) : v;
                                const required = !varDecl.optional;
                                return (
                                    <Form.Item
                                        label={`[${i}]`}
                                        name={`output.${i}.name`}
                                        key={`output.${i}.name`}
                                        required={required}
                                    >
                                        <Input disabled={true} />
                                    </Form.Item>
                                );
                            })}
                        </>
                    )}
                </Form>
            </div>
        </>
    );
};

/**
 * Inspector 根组件
 * 
 * 根据 workspace 当前状态切换展示 TreeInspector/NodeInspector/NodeDefInspector
 */
/**
 * Inspector 根组件 - 属性检查器容器
 * 
 * 布局设计：
 * - 容器尺寸：width: 100%, height: 100%，完全填充父容器
 * - 背景样式：使用主题背景色，与编辑器整体风格一致
 * - 条件渲染：根据当前编辑状态切换不同的检查器组件
 *   - TreeInspector: 树属性编辑（标签列宽 160px）
 *   - NodeInspector: 节点属性编辑（标签列宽 72px）
 *   - NodeDefInspector: 节点定义查看（标签列宽 72px）
 * - 响应式设计：自适应容器大小变化
 * - 滚动处理：各子组件内部处理滚动，根组件不滚动
 */
export const Inspector: FC = () => {
    const workspace = {
        editingNode: useWorkspace((state) => state.editingNode),
        editingTree: useWorkspace((state) => state.editingTree),
        editingNodeDef: useWorkspace((state) => state.editingNodeDef),
    };
    let isEditingNode = false;
    let isEditingTree = false;
    let isEditingNodeDef = false;
    if (workspace.editingNodeDef) {
        isEditingNodeDef = true;
    } else if (workspace.editingTree) {
        isEditingTree = true;
    } else if (workspace.editingNode) {
        isEditingNode = true;
    }
    return (
        <Flex
            vertical
            className="b3-inspector"
            style={{ height: "100%", width: "360px", borderLeft: `1px solid var(--b3-color-border)` }}
        >
            {isEditingNodeDef && <NodeDefInspector />}
            {isEditingTree && <TreeInspector />}
            {isEditingNode && <NodeInspector />}
        </Flex>
    );
};
