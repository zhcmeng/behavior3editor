import React, { FC } from 'react';
import { ArgType } from '../../misc/b3type';
import { ArgEditor } from './ArgEditor';

/**
 * 参数项属性接口
 */
export interface ArgItemProps {
    /** 参数名 */
    name: string;
    /** 参数描述 */
    desc?: string;
    /** 参数类型 */
    type?: ArgType;
    /** 参数值 */
    value?: any;
    /** 值类型 (int, string, bool等) */
    valueType?: string;
    /** 选择选项 */
    options?: Array<{ label: string; value: string | number | null | undefined }>;
    /** 是否必填 */
    required?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否只读 */
    readonly?: boolean;
    /** 值变化回调 */
    onChange?: (value: any) => void;
    /** 失焦回调 */
    onBlur?: () => void;
    /** 自定义样式 */
    style?: React.CSSProperties;
    /** 自定义类名 */
    className?: string;
}

/**
 * ParamItem 组件 - 参数项基础组件
 * 
 * 这是所有参数编辑的基础组件，支持：
 * - 只读模式：显示参数名和值，用于输入/输出参数
 * - 编辑模式：使用 VarEditor 进行值编辑，用于节点参数
 * - 统一的样式和布局
 * - 完整的类型支持
 */
export const ArgItem: FC<ArgItemProps> = ({
    name,
    desc,
    value,
    valueType = 'string',
    options,
    required = false,
    disabled = false,
    readonly = false,
    onChange,
    onBlur,
    style,
    className
}) => {
    // 显示的标签文本
    const displayLabel = desc || name;

    // 只读模式渲染
    if (readonly) {
        return (
            <div
                style={{
                    marginBottom: '8px',
                    ...style
                }}
                className={className}
            >
                {/* 参数标签 */}
                <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '4px',
                    color: '#f5f5f5'
                }}>
                    {displayLabel}:
                </div>
                {/* 参数值显示 */}
                <div style={{
                    padding: '4px 8px',
                    backgroundColor: '#d9d9d9',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#262626',
                    wordBreak: 'break-all'
                }}>
                    {typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value || name)
                    }
                </div>
            </div>
        );
    }

    // 编辑模式渲染
    return (
        <div
            style={{
                marginBottom: '8px',
                ...style
            }}
            className={className}
        >
            {/* 参数标签（编辑模式下可选显示） */}
            {displayLabel && (
                <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '4px',
                    color: required ? '#ff4d4f' : '#262626'
                }}>
                    {displayLabel}{required ? ' *' : ''}:
                </div>
            )}

            {/* 参数值编辑器 */}
            <ArgEditor
                value={value}
                onChange={onChange}
                disabled={disabled}
                onBlur={onBlur}
                valueType={valueType}
                options={options}
                placeholder={`请输入${displayLabel || '参数值'}`}
            />
        </div>
    );
};

export default ArgItem;