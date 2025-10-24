import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeInputArgs, NodeInputArgsProps } from './NodeInputArgs';

/**
 * 节点输出参数组件属性接口
 * 继承自 NodeInputParamsProps，但移除了一些不适用的属性
 */
export interface NodeOutputArgsProps extends NodeInputArgsProps {
    /** 输出参数定义 */
    outputs: NodeInputArgsProps['inputs'];
}

/**
 * NodeOutputArgs 组件 - 节点输出参数组件
 * 
 * 复用 NodeInputParams 组件来渲染输出参数，特点：
 * - 完全复用输入参数组件的逻辑和样式
 * - 默认只读模式
 * - 只显示 object_var 类型的参数（符合输出参数的语义）
 * - 使用不同的默认标题
 * - 保持与输入参数一致的用户体验
 */
export const NodeOutputArgs: FC<NodeOutputArgsProps> = ({
    outputs,
    title,
    ...restProps
}) => {
    const { t } = useTranslation();

    // 如果没有输出参数，不渲染任何内容
    if (!outputs || outputs.length === 0) {
        return null;
    }

    return (
        <NodeInputArgs
            {...restProps}
            inputs={outputs}
            title={title || t("node.output", "输出参数")}
            readonly={true} // 输出参数始终为只读
        />
    );
};

export default NodeOutputArgs;