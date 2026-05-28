import { stratify, tree } from 'd3-hierarchy';
import { Edge, Node } from 'reactflow';

export interface FileTreeNode {
  id: string;
  path: string;
  name: string;
  children?: FileTreeNode[];
}

interface FileTreeItem {
  path: string;
  name: string;
}

export const createFileTreeGraph = (filePaths: string[]) => {
  const hierarchy = stratify<FileTreeItem>()
    .id((d) => d.path)
    .parentId((d) => d.path.substring(0, d.path.lastIndexOf('/')))(
      filePaths.map((path) => ({
        path,
        name: path.substring(path.lastIndexOf('/') + 1),
      }))
    );

  const layout = tree<FileTreeItem>().nodeSize([200, 150]);
  const root = layout(hierarchy);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  root.each((node) => {
    nodes.push({
      id: node.id!,
      position: { x: node.x, y: node.y },
      data: { label: node.data.name, type: node.children ? 'folder' : 'file' },
      type: 'custom',
    });

    if (node.parent) {
      edges.push({
        id: `${node.parent.id}-${node.id}`,
        source: node.parent.id!,
        target: node.id!,
        type: 'smoothstep',
      });
    }
  });

  return { nodes, edges };
};

export const createDependencyGraph = (dependencies: { [key: string]: string }, packageJson: any) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerNodeId = packageJson.name || 'root';

    // Add the root package node
    nodes.push({
        id: centerNodeId,
        position: { x: 0, y: 0 },
        data: { label: centerNodeId, type: 'root' },
        type: 'custom',
    });

    const depKeys = Object.keys(dependencies);
    const angleStep = (2 * Math.PI) / depKeys.length;
    const radius = 400;

    depKeys.forEach((dep, i) => {
        const angle = i * angleStep;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        nodes.push({
            id: dep,
            position: { x, y },
            data: { label: `${dep}@${dependencies[dep]}`, type: 'dependency' },
            type: 'custom',
        });

        edges.push({
            id: `${centerNodeId}-${dep}`,
            source: centerNodeId,
            target: dep,
            type: 'smoothstep',
        });
    });

    return { nodes, edges };
};

export const createComponentRelationshipGraph = (parsedData: any[]) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeSet = new Set<string>();

    parsedData.forEach(file => {
        const filePath = file.filePath;
        if (!nodeSet.has(filePath)) {
            nodes.push({
                id: filePath,
                position: { x: Math.random() * 800, y: Math.random() * 600 },
                data: { label: filePath.substring(filePath.lastIndexOf('/') + 1), type: 'file' },
                type: 'custom',
            });
            nodeSet.add(filePath);
        }

        file.dependencies.forEach((dep: string) => {
            // For now, only link internal dependencies
            const depPath = parsedData.find(f => f.filePath.includes(dep))?.filePath;
            if (depPath) {
                if (!nodeSet.has(depPath)) {
                    nodes.push({
                        id: depPath,
                        position: { x: Math.random() * 800, y: Math.random() * 600 },
                        data: { label: depPath.substring(depPath.lastIndexOf('/') + 1), type: 'file' },
                        type: 'custom',
                    });
                    nodeSet.add(depPath);
                }
                edges.push({
                    id: `${filePath}-${depPath}`,
                    source: filePath,
                    target: depPath,
                    type: 'smoothstep',
                });
            }
        });
    });

    return { nodes, edges };
};
