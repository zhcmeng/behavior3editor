import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Form, Space } from 'antd';
import React from 'react';
import type { NodeArg, NodeData, VarDecl } from '../../misc/b3type';
import { getNodeArgValueType, isNodeArgArray, isNodeArgOptional } from '../../misc/b3util';
import { ArgEditor } from './ArgEditor';

export interface NodeArgProps {
  /** 参数定义列表 */
  args: NodeArg[];
  /** 当前编辑的节点数据 */
  editingNode: { data: NodeData };
  /** 是否禁用 */
  disabled?: boolean;
  /** 失焦回调 */
  onBlur?: () => void;
  /** 是否显示标题分割线 */
  showDivider?: boolean;
  /** 自定义标题 */
  title?: string;
  /** 可用参数（用于表达式校验） */
  usingVars?: Record<string, VarDecl> | null;
  /** 参数校验函数 */
  validateArg?: (node: NodeData, arg: NodeArg, value: unknown, usingVars: Record<string, VarDecl> | null) => Promise<void>;
}

/**
 * NodeArguments 组件
 * 
 * 用于渲染节点的参数配置，支持：
 * - 基础类型参数（string, int, float, bool, json, expr）
 * - 数组类型参数（支持动态添加/删除）
 * - 参数校验
 * - 预定义选项（下拉选择）
 */
export const NodeArgs: React.FC<NodeArgProps> = ({
    args,
    editingNode,
    disabled = false,
    onBlur,
    showDivider = true,
    title = "节点参数",
    usingVars,
    validateArg
}) => {
    // 渲染单个参数输入
    const renderArgInput = (arg: NodeArg) => {
        const isArray = isNodeArgArray(arg);
        const valueType = getNodeArgValueType(arg);

        if (isArray) {
            return (
                <Form.List name={arg.name}>
                    {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item
                            {...restField}
                            name={name}
                            style={{ margin: 0, flex: 1 }}
                            >
                            <ArgEditor
                                disabled={disabled}
                                placeholder={arg.desc || `请输入${arg.name}`}
                                onBlur={onBlur}
                                valueType={valueType}
                                options={arg.options?.map(option => ({ label: option.name, value: option.value as string | number | null | undefined }))}
                                label={`${arg.desc || arg.name} #${name + 1}`}
                                required={!isNodeArgOptional(arg)}
                                showLabel={true}
                            />
                            </Form.Item>
                            <Button
                            type="text"
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(name)}
                            disabled={disabled}
                            size="small"
                            />
                        </Space>
                        ))}
                        <Form.Item>
                        <Button
                            type="dashed"
                            onClick={() => add()}
                            block
                            icon={<PlusOutlined />}
                            disabled={disabled}
                            size="small"
                        >
                            添加{arg.desc || arg.name}
                        </Button>
                        </Form.Item>
                    </>
                    )}
                </Form.List>
            );
        }

        return (
            <ArgEditor
                disabled={disabled}
                placeholder={arg.desc || `请输入${arg.name}`}
                onBlur={onBlur}
                valueType={valueType}
                options={arg.options?.map(option => ({ label: option.name, value: option.value as string | number | null | undefined }))}
                label={arg.desc || arg.name}
                required={!isNodeArgOptional(arg)}
                showLabel={true}
            />
      );
    };

    if (args.length === 0) {
        return null;
    }

    return (
      <>
        {showDivider && <Divider orientation="left">{title}</Divider>}
        {args.map((arg, i) => {
            const isOptional = isNodeArgOptional(arg);

            return (
                <Form.Item
                    key={`args.${i}`}
                    name={["args", i]}
                    rules={[
                        {
                            required: !isOptional,
                            message: `请输入${arg.desc || arg.name}`,
                        },
                        {
                            validator: async (_, value) => {
                                if (validateArg) {
                                    await validateArg(editingNode.data, arg, value, usingVars || null);
                                }
                            },
                        },
                    ]}
                    style={{ marginBottom: 16 }}
                >
                {renderArgInput(arg)}
                </Form.Item>
            );
        })}
      </>
    );
};

export default NodeArgs;