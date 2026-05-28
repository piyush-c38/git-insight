import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';
import GraphLegend from './GraphLegend';

interface ReactFlowGraphProps {
  nodes: Node[];
  edges: Edge[];
}

const nodeTypes = {
  custom: CustomNode,
};

export default function ReactFlowGraph({ nodes, edges }: ReactFlowGraphProps) {
  return (
    <div className="w-full h-full bg-surface-1 rounded-lg border border-outline">
      <ReactFlow nodes={nodes} edges={edges} fitView nodeTypes={nodeTypes}>
        <Background />
        <Controls />
        <MiniMap />
        <GraphLegend />
      </ReactFlow>
    </div>
  );
}
