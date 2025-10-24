import { Divider } from 'antd';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VarDecl } from '../../misc/b3type';
import { ArgItem } from './ArgItem';

/**
 * 格式化变量标签显示
 * @param name 变量名
 * @param type 变量类型
 * @param t 翻译函数
 * @returns 格式化后的标签
 */
const formatVariableLabel = (name: string, type: string, t: any): string => {
    const typeLabel = type === 'object_var' ? t("tree.vars.type.object", "对象变量") :
        type === 'cfg_var' ? t("tree.vars.type.config", "配置变量") : type;
    return `${name} (${typeLabel})`;
};

/**
 * 节点输入参数组件属性接口
 */
export interface NodeInputArgsProps {
    /** 输入参数定义 */
    inputs: (string | VarDecl)[];
    /** 当前值 */
    values?: any[];
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否只读 */
    readonly?: boolean;
    /** 值变化回调 */
    onChange?: (values: any[]) => void;
    /** 是否显示标题分割线 */
    showDivider?: boolean;
    /** 自定义标题 */
    title?: string;
}

/**
 * NodeInputParams 组件 - 节点输入参数组件
 * 
 * 用于渲染节点的输入参数列表，特点：
 * - 支持字符串和 VarDecl 两种参数定义格式
 * - 默认为只读模式，显示参数名和描述
 * - 只显示 object_var 类型的参数（符合输入参数的语义）
 * - 统一的样式和布局
 * - 可选的标题分割线
 * - 支持国际化
 */
export const NodeInputArgs: FC<NodeInputArgsProps> = ({
    inputs,
    values = [],
    disabled = false,
    readonly = true,
    onChange,
    showDivider = true,
    title
}) => {
    const { t } = useTranslation();

    // 过滤输入参数，只保留 object_var 类型的参数
    const filteredInputs = useMemo(() => {
        return inputs.filter(input => {
            // 如果是字符串，保留（向后兼容）
            if (typeof input === 'string') {
                return true;
            }
            // 如果是 VarDecl 对象，只保留 object_var 类型
            return input.type === 'object_var';
        });
    }, [inputs]);

    // 如果没有输入参数或过滤后为空，不渲染任何内容
    if (!inputs || inputs.length === 0 || filteredInputs.length === 0) {
        return null;
    }

    return (
        <>
            {/* 可选的标题分割线 */}
            {showDivider && (
                <Divider orientation="left">
                    <h4>{title || t("node.input", "输入参数")}</h4>
                </Divider>
            )}

            {/* 渲染过滤后的参数列表 */}
            <div style={{ marginBottom: '16px' }}>
                {filteredInputs.map((input, index) => {
                    // 找到原始索引（用于值的映射）
                    const originalIndex = inputs.indexOf(input);

                    // 处理字符串格式的参数（向后兼容）
                    if (typeof input === 'string') {
                        return (
                            <ArgItem
                                key={`input-${originalIndex}`}
                                name={input}
                                value={values[originalIndex]}
                                readonly={readonly}
                                disabled={disabled}
                                onChange={onChange ? (value) => {
                                    const newValues = [...values];
                                    newValues[originalIndex] = value;
                                    onChange(newValues);
                                } : undefined}
                            />
                        );
                    }

                    // 处理 VarDecl 格式的参数（只有 object_var 类型）
                    const varDecl = input as VarDecl;
                    return (
                        <ArgItem
                            key={`input-${originalIndex}`}
                            name={formatVariableLabel(varDecl.name, varDecl.type, t)}
                            desc={varDecl.desc}
                            type={varDecl.type as any}
                            value={values[originalIndex]}
                            readonly={readonly}
                            disabled={disabled}
                            onChange={onChange ? (value) => {
                                const newValues = [...values];
                                newValues[originalIndex] = value;
                                onChange(newValues);
                            } : undefined}
                        />
                    );
                })}
            </div>
        </>
    );
};

export default NodeInputArgs;