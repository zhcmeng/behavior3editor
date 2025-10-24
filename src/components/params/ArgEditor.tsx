/**
 * VarEditor 组件 - 变量值编辑器
 * 
 * 提供类型选择和值输入的组合控件
 * 1. 类型下拉框：选择 VarType（const_var, object_var, cfg_var, code_var）
 * 2. 值输入框：根据类型提供不同的输入方式
 */
import {
    AutoComplete,
    Input,
    InputNumber,
    Select,
    Switch,
} from 'antd';
import { DefaultOptionType } from 'antd/es/select';
import React, { FC, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspace } from '../../contexts/workspace-context';
import { ArgType } from '../../misc/b3type';
import { formatVariableLabel } from '../../misc/b3util';

const { TextArea } = Input;

/**
 * ArgEditor 组件属性接口
 */
export interface ArgEditorProps {
    value?: { type: ArgType; value: unknown };  // 可选，支持 Form.Item 自动注入
    onChange?: (value: { type: ArgType; value: unknown } | undefined) => void;
    disabled?: boolean;
    placeholder?: string;
    onBlur?: () => void;
    valueType?: string;
    options?: DefaultOptionType[];
    // 新增：名字渲染相关属性
    label?: string;           // 参数名字/标签
    required?: boolean;       // 是否必填
    showLabel?: boolean;      // 是否显示标签，默认true
}

/**
 * ArgEditor 组件 - 参数值编辑器
 * 
 * 布局设计：
 * - 水平 Flex 布局：类型选择器 + 值输入器
 * - 类型选择器：固定宽度 88px，确保类型标签显示完整
 * - 值输入器：flex: 1，自动填充剩余空间
 * - 组件间距：4px gap
 * - 对齐方式：垂直居中对齐
 * 
 * 这是节点参数编辑的核心组件，支持：
 * - 常量值（CONST_VAR）：根据 valueType 选择合适的输入控件
 * - 对象变量（OBJECT_VAR）：变量名自动完成
 * - 配置变量（CFG_VAR）：配置项自动完成  
 * - 代码表达式（CODE_VAR）：代码片段自动完成
 */
export const ArgEditor: FC<ArgEditorProps> = ({
    value,
    onChange,
    disabled,
    placeholder,
    onBlur,
    valueType,
    options,
    label,
    required,
    showLabel = true
}) => {
    const workspace = useWorkspace(
        useShallow((state) => ({
            usingVars: state.usingVars,
        }))
    );
    // 国际化翻译钩子，用于获取多语言文本
    const { t } = useTranslation();

    // 当前值：提供默认值处理，确保数据完整性
    const currentValue = value || { type: ArgType.CONST_VAR, value: undefined };

    const allowedTypes = useMemo(() => {
        if (valueType === "expr") return [ArgType.CODE_VAR];
        if (valueType === "json") return [ArgType.JSON_VAR];
        if (options && options.length > 0) return [ArgType.CONST_VAR];
        return [ArgType.CONST_VAR, ArgType.OBJECT_VAR, ArgType.CFG_VAR, ArgType.CODE_VAR, ArgType.JSON_VAR];
    }, [valueType, options]);

    // 当 allowedTypes 变化时，若当前类型不在允许列表中，则自动重置为允许列表中的第一项
    useEffect(() => {
        if (!allowedTypes.includes(currentValue.type)) {
            onChange?.({ type: allowedTypes[0], value: undefined });
        }
    }, [allowedTypes, currentValue.type, onChange]);

    // 处理类型变化
    /**
     * 处理变量类型切换
     * 当用户改变变量类型时，清空原值并触发外部 onChange 回调
     * @param newType 新的变量类型
     */
    const handleTypeChange = (newType: ArgType) => {
        const newValue = { type: newType, value: undefined };
        onChange?.(newValue);
    };

    // 处理值变化
    const handleValueChange = (newValue: unknown) => {
        const updatedValue = { ...currentValue, value: newValue };
        onChange?.(updatedValue);
    };

    // 获取可用变量选项
    const getVariableOptions = (varType: ArgType) => {
        if (!workspace.usingVars) return [];

        return Object.values(workspace.usingVars)
            .filter(v => v.type === varType)
            .map(v => ({
                label: formatVariableLabel(v.name, v.type, t),
                value: v.name
            }));
    };

    /**
     * 渲染值输入控件 - 根据变量类型和值类型动态选择合适的输入组件
     * 
     * 这是一个核心函数，负责为不同类型的变量提供最合适的用户界面：
     * 1. 变量类型（VarType）决定数据来源和编辑方式
     * 2. 值类型（valueType）决定具体的输入控件类型
     * 3. 选项（options）决定是否使用下拉选择
     */
    const renderValueInput = () => {
        switch (currentValue.type) {
            // ==================== 引用类型变量 ====================
            case ArgType.OBJECT_VAR:
            case ArgType.CFG_VAR:
                /**
                 * 对象变量和配置变量处理
                 * 
                 * 特点：
                 * - 这些变量引用已存在的变量名，而不是直接存储值
                 * - 用户需要从可用变量列表中选择，或手动输入变量名
                 * - 支持自动完成和模糊搜索
                 * 
                 * 使用场景：
                 * - OBJECT_VAR: 引用运行时对象，如 player.health、enemy.position
                 * - CFG_VAR: 引用配置参数，如 game.difficulty、ui.language
                 */
                const variableOptions = getVariableOptions(currentValue.type);
                return (
                    <AutoComplete
                        // 显示当前选中的变量名（字符串形式）
                        value={String(currentValue.value || '')}
                        onChange={handleValueChange}
                        onBlur={onBlur}
                        disabled={disabled}
                        // 动态占位符：根据变量类型显示不同提示
                        placeholder={`选择${currentValue.type === ArgType.OBJECT_VAR ? '对象' : '配置'}变量`}
                        options={variableOptions}
                        // 模糊搜索：支持大小写不敏感的变量名匹配
                        filterOption={(inputValue, option) => {
                            const label = option!.label as string;
                            return label.toUpperCase().includes(inputValue.toUpperCase());
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                );

            // ==================== 代码表达式变量 ====================
            case ArgType.CODE_VAR:
                /**
                 * 代码变量处理
                 * 
                 * 特点：
                 * - 存储可执行的代码片段或表达式
                 * - 支持多行输入，便于编写复杂逻辑
                 * - 运行时会被解析和执行
                 * 
                 * 使用场景：
                 * - 条件判断：player.health > 50 && enemy.distance < 10
                 * - 数学计算：Math.sqrt(x*x + y*y)
                 * - 复杂逻辑：if (time > 60) return "timeout"; else return "continue"
                 */
                return (
                    <TextArea
                        value={String(currentValue.value || '')}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleValueChange(e.target.value)}
                        onBlur={onBlur}
                        disabled={disabled}
                        placeholder="输入代码表达式"
                        rows={2}  // 2行高度，适合短表达式
                        style={{ flex: 1, minWidth: 0 }}
                    />
                );

            // ==================== JSON数据变量 ====================
            case ArgType.JSON_VAR:
                /**
                 * JSON变量处理（新增类型）
                 * 
                 * 特点：
                 * - 专门用于存储JSON格式的结构化数据
                 * - 支持多行输入，便于编写复杂的JSON结构
                 * - 与普通字符串区分，提供更好的语义化
                 * 
                 * 使用场景：
                 * - 配置对象：{"width": 800, "height": 600, "fullscreen": false}
                 * - 数据结构：{"players": [{"name": "Alice", "score": 100}]}
                 * - API请求体：{"action": "login", "username": "user", "password": "pass"}
                 */
                return (
                    <TextArea
                        value={String(currentValue.value || '')}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleValueChange(e.target.value)}
                        onBlur={onBlur}
                        disabled={disabled}
                        placeholder="输入JSON格式数据"
                        rows={3}  // 3行高度，适合JSON结构
                        style={{ flex: 1, minWidth: 0 }}
                    />
                );

            // ==================== 常量变量（默认类型）====================
            case ArgType.CONST_VAR:
            default:
                /**
                 * 常量变量处理 - 最复杂的分支，需要根据多个条件选择控件
                 * 
                 * 决策优先级：
                 * 1. 预定义选项（options）→ Select 下拉选择
                 * 2. 数值类型（int/float）→ InputNumber 数字输入
                 * 3. 布尔类型（bool）→ Switch 开关
                 * 4. JSON类型（json）→ TextArea JSON编辑
                 * 5. 表达式类型（expr）→ TextArea 代码编辑
                 * 6. 默认 → Input 文本输入
                 */

                // 优先级1：预定义选项 - 枚举值选择
                if (options && options.length > 0) {
                    /**
                     * 下拉选择框处理
                     * 
                     * 使用场景：
                     * - 日志级别：["debug", "info", "warn", "error"]
                     * - 运算符：["+", "-", "*", "/"]
                     * - 状态选项：["idle", "running", "paused"]
                     * 
                     * 特点：
                     * - 限制用户只能从预定义值中选择
                     * - 避免输入错误，提高数据质量
                     * - 提供更好的用户体验
                     */
                    return (
                        <Select
                            value={currentValue.value as string | undefined}
                            onChange={handleValueChange}
                            onBlur={onBlur as any}
                            disabled={disabled}
                            placeholder={placeholder || "请选择"}
                            style={{ flex: 1, minWidth: 0 }}
                            options={options}
                        />
                    );
                }

                // 优先级2：数值类型 - 整数和浮点数
                if (valueType === "int" || valueType === "float") {
                    /**
                     * 数字输入框处理
                     * 
                     * 特点：
                     * - 自动验证数字格式
                     * - 支持键盘上下键调整数值
                     * - int类型自动限制为整数
                     * - 提供数字相关的用户体验（如千分位分隔符）
                     * 
                     * 使用场景：
                     * - 生命值：100
                     * - 坐标：{x: 10.5, y: 20.3}
                     * - 时间：3.14
                     */
                    return (
                        <InputNumber
                            // 类型安全：只有当值确实是数字时才显示，否则显示空
                            value={typeof currentValue.value === 'number' ? (currentValue.value as number) : undefined}
                            onChange={handleValueChange}
                            onBlur={onBlur}
                            disabled={disabled}
                            placeholder={placeholder || "输入数值"}
                            style={{ flex: 1, minWidth: 0, width: '100%' }}
                        />
                    );
                }

                // 优先级3：布尔类型 - 开关控件
                if (valueType === "bool") {
                    /**
                     * 布尔开关处理
                     * 
                     * 特点：
                     * - 直观的开关界面，比下拉框更适合布尔值
                     * - 自动处理 true/false 转换
                     * - 支持键盘空格键切换
                     * 
                     * 使用场景：
                     * - 功能开关：启用/禁用某个功能
                     * - 状态标志：是否完成、是否可见
                     * - 配置选项：调试模式、自动保存
                     */
                    return (
                        <Switch
                            // 安全的布尔值转换：任何值都能转换为布尔值
                            checked={Boolean(currentValue.value)}
                            onChange={(checked) => handleValueChange(checked)}
                            disabled={disabled}
                        />
                    );
                }

                // 优先级4：JSON类型 - 在常量模式下的JSON编辑
                if (valueType === "json") {
                    /**
                     * JSON文本区域处理（常量模式）
                     * 
                     * 与 JSON_VAR 的区别：
                     * - JSON_VAR：变量类型本身就是JSON，用于变量声明
                     * - valueType="json"：参数值类型是JSON，但变量类型是常量
                     * 
                     * 使用场景：
                     * - 节点参数需要JSON格式的配置数据
                     * - 初始化数据：{"level": 1, "exp": 0}
                     * - 静态配置：{"theme": "dark", "language": "zh"}
                     */
                    return (
                        <TextArea
                            value={String(currentValue.value || '')}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleValueChange(e.target.value)}
                            onBlur={onBlur}
                            disabled={disabled}
                            placeholder={placeholder || "输入JSON格式数据"}
                            rows={3}
                            style={{ flex: 1, minWidth: 0 }}
                        />
                    );
                }

                // 优先级5：表达式类型 - 在常量模式下的表达式编辑
                if (valueType === "expr") {
                    /**
                     * 表达式文本区域处理（常量模式）
                     * 
                     * 与 CODE_VAR 的区别：
                     * - CODE_VAR：变量类型本身就是代码，用于变量声明
                     * - valueType="expr"：参数值类型是表达式，但变量类型是常量
                     * 
                     * 使用场景：
                     * - 节点参数需要表达式计算
                     * - 条件表达式：x > 10 && y < 20
                     * - 计算公式：Math.pow(base, exponent)
                     */
                    return (
                        <TextArea
                            value={String(currentValue.value || '')}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleValueChange(e.target.value)}
                            onBlur={onBlur}
                            disabled={disabled}
                            placeholder={placeholder || "输入代码表达式"}
                            rows={2}
                            style={{ flex: 1, minWidth: 0 }}
                        />
                    );
                }

                // 优先级6：默认文本输入 - 字符串和其他类型
                /**
                 * 默认文本输入框处理
                 * 
                 * 适用场景：
                 * - 字符串类型：名称、描述、路径
                 * - 未知类型：作为后备方案
                 * - 简单文本：单行输入即可满足需求
                 * 
                 * 特点：
                 * - 最通用的输入方式
                 * - 适合大多数简单数据类型
                 * - 作为类型系统的安全后备
                 */
                return (
                    <Input
                        value={String(currentValue.value || '')}
                        onChange={(e) => handleValueChange(e.target.value)}
                        onBlur={onBlur}
                        disabled={disabled}
                        placeholder={placeholder || "输入常量值"}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                );
        }
    };

    // 主布局：单行水平布局，标签 + 类型选择器 + 值编辑器
    return (
        <div style={{ 
            display: 'flex', 
            gap: '8px', 
            width: '100%', 
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'nowrap'
        }}>
            {/* 标签部分 */}
            <div style={{ 
                fontSize: 14, 
                color: '#fff7e6', 
                fontWeight: 500,
                minWidth: 'fit-content',
                whiteSpace: 'nowrap'
            }}>
              {label}
            </div>
                {/* 类型选择器 - 固定宽度，确保类型标签显示完整 */}
                <Select
                    value={currentValue.type}
                    onChange={handleTypeChange}
                    disabled={disabled}
                    style={{ width: '88px' }}  // 固定宽度：88px
                    options={allowedTypes.map((vt) => {
                        switch (vt) {
                            case ArgType.CONST_VAR:
                                return { label: t("tree.vars.type.const", "常量"), value: ArgType.CONST_VAR };
                            case ArgType.OBJECT_VAR:
                                return { label: t("tree.vars.type.object", "对象变量"), value: ArgType.OBJECT_VAR };
                            case ArgType.CFG_VAR:
                                return { label: t("tree.vars.type.config", "配置变量"), value: ArgType.CFG_VAR };
                            case ArgType.CODE_VAR:
                                return { label: t("tree.vars.type.code", "代码变量"), value: ArgType.CODE_VAR };
                            case ArgType.JSON_VAR:
                                return { label: t("tree.vars.type.json", "JSON变量"), value: ArgType.JSON_VAR };
                            default:
                                return { label: String(vt), value: vt };
                        }
                    })}
                />
                {renderValueInput()}
        </div>
    );
};

export default ArgEditor;