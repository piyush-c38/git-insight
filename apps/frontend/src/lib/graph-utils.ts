import { stratify, tree } from 'd3-hierarchy';
import { Edge, Node } from 'reactflow';

export type DependencyCategory = 'prod' | 'dev' | 'peer' | 'optional' | 'unknown';

export interface DeclaredDependency {
  name: string;
  version: string;
  category: DependencyCategory;
  semanticCategory?: string;
}

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
  const items = new Map<string, FileTreeItem>();
  const ensurePath = (pathValue: string) => {
    if (!pathValue) return;
    if (!items.has(pathValue)) {
      items.set(pathValue, {
        path: pathValue,
        name: pathValue.substring(pathValue.lastIndexOf('/') + 1) || pathValue,
      });
    }
    const parent = pathValue.substring(0, pathValue.lastIndexOf('/'));
    if (parent) {
      ensurePath(parent);
    }
  };

  filePaths.forEach((pathValue) => ensurePath(pathValue));

  const hierarchy = stratify<FileTreeItem>()
    .id((d) => d.path)
    .parentId((d) => {
      const parent = d.path.substring(0, d.path.lastIndexOf('/'));
      return parent || null;
    })(Array.from(items.values()));

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

export const createDependencyGraph = (dependencies: Record<string, DeclaredDependency>, packageJson: any) => {
  const declaredDependencies = dependencies;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const centerNodeId = packageJson?.name || 'root';

  nodes.push({
    id: centerNodeId,
    position: { x: 0, y: 0 },
    data: { label: centerNodeId, type: 'root' },
    type: 'custom',
  });

  const depKeys = Object.keys(declaredDependencies);
  if (depKeys.length === 0) {
    return { nodes, edges };
  }

  const perRing = depKeys.length > 18 ? 7 : depKeys.length > 10 ? 5 : depKeys.length > 0 ? depKeys.length : 1;
  const ringSpacing = depKeys.length > 18 ? 150 : depKeys.length > 10 ? 90 : 70;
  const totalRings = Math.max(1, Math.ceil(depKeys.length / perRing));

  depKeys.forEach((dep, i) => {
    const ringIndex = Math.floor(i / perRing);
    const indexInRing = i % perRing;
    const nodesInRing = Math.min(perRing, depKeys.length*2 - ringIndex * perRing);
    const angleStep = (2 * Math.PI) / nodesInRing;
    const angleOffset = ringIndex % 2 === 0 ? 0 : angleStep / 2;
    const radius = ringSpacing * (ringIndex + 1);
    const angle = indexInRing * angleStep + angleOffset;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const dependency = declaredDependencies[dep];

    nodes.push({
      id: dep,
      position: { x, y },
      data: { label: `${dep}@${dependency.version}`, type: 'dependency' },
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

export type DependencySummaryPayload = {
  byCategory?: Record<
    string,
    Array<{ name: string; version: string; category: string; explanation?: string; source?: string }>
  >;
  byPackage?: Record<
    string,
    {
      manifestPath: string;
      dependencies: Array<{ name: string; version: string; category: string; source?: string }>;
    }
  >;
};

const DISPLAY_CATEGORY_MAP: Record<string, string> = {
  UI: 'Frontend',
  Other: 'Utilities',
};

function addClassifiedDep(
  result: Record<string, DeclaredDependency>,
  dep: { name: string; version: string; category: string; source?: string },
  fallbackCategory?: string
) {
  const displayCategory = DISPLAY_CATEGORY_MAP[dep.category] ?? dep.category ?? fallbackCategory;
  const scope =
    dep.source?.includes('#devDependencies') || dep.source?.includes('devDependencies') ? 'dev' : 'prod';
  result[dep.name] = {
    name: dep.name,
    version: dep.version,
    category: (scope === 'dev' ? 'dev' : 'prod') as DependencyCategory,
    semanticCategory: displayCategory,
  };
}

export function packageDepsFromKnowledge(
  summary?: DependencySummaryPayload | null
): Record<string, DeclaredDependency> {
  if (!summary) return {};

  const result: Record<string, DeclaredDependency> = {};

  if (summary.byPackage) {
    for (const pkg of Object.values(summary.byPackage)) {
      if (!pkg?.dependencies?.length) continue;
      for (const dep of pkg.dependencies) {
        addClassifiedDep(result, dep);
      }
    }
  }

  if (Object.keys(result).length > 0) {
    return result;
  }

  if (!summary.byCategory) return {};

  for (const [category, deps] of Object.entries(summary.byCategory)) {
    if (!Array.isArray(deps)) continue;
    for (const dep of deps) {
      addClassifiedDep(result, dep, category);
    }
  }
  return result;
}

export const getDeclaredPackageDependencies = (packageJson: any) => {
  const sections: Array<{ category: DependencyCategory; value: unknown }> = [
    { category: 'prod', value: packageJson?.dependencies },
    { category: 'dev', value: packageJson?.devDependencies },
    { category: 'peer', value: packageJson?.peerDependencies },
    { category: 'optional', value: packageJson?.optionalDependencies },
  ];

  return sections.reduce((acc, section) => {
    if (!section.value || typeof section.value !== 'object') return acc;

    return Object.entries(section.value as Record<string, string>).reduce((next, [name, version]) => {
      next[name] = {
        name,
        version,
        category: section.category,
      };
      return next;
    }, acc);
  }, {} as Record<string, DeclaredDependency>);
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

const sanitizeMermaidId = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

export type ArchitectureKnowledgePayload = {
  diagram?: {
    mermaid?: string;
    nodes?: { id: string; label: string; layer: string }[];
  };
  summary?: string;
};

export const createArchitectureMermaid = (
  repoUrl: string,
  files: string[],
  architecture?: ArchitectureKnowledgePayload | null
) => {
  if (architecture?.diagram?.mermaid) {
    return architecture.diagram.mermaid;
  }

  const topLevelCounts = new Map<string, number>();
  files.forEach((filePath) => {
    const normalized = filePath.replace(/^[A-Za-z]:/g, '');
    const parts = normalized.split('/').filter(Boolean);
    const top = parts.length > 0 ? parts[0] : 'root';
    topLevelCounts.set(top, (topLevelCounts.get(top) || 0) + 1);
  });

  const repoLabel = repoUrl || 'repository';
  const repoId = sanitizeMermaidId(repoLabel);
  const lines = [`graph TD`, `${repoId}["${repoLabel}"]`];

  Array.from(topLevelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([folder, count]) => {
      const nodeId = sanitizeMermaidId(folder);
      lines.push(`${nodeId}["${folder} (${count})"]`);
      lines.push(`${repoId} --> ${nodeId}`);
    });

  return lines.join('\n');
};

export const createLogicalArchitectureGraph = (architecture?: ArchitectureKnowledgePayload | null) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (!architecture?.diagram?.nodes?.length) {
    return { nodes, edges };
  }

  const layerY: Record<string, number> = {
    frontend: 0,
    shared: 120,
    backend: 240,
    database: 360,
    external: 480,
  };

  const layerCounts = new Map<string, number>();

  architecture.diagram.nodes.forEach((node, index) => {
    const layer = node.layer || 'shared';
    const count = layerCounts.get(layer) ?? 0;
    layerCounts.set(layer, count + 1);
    const x = count * 220;
    const y = layerY[layer] ?? index * 80;

    nodes.push({
      id: node.id,
      position: { x, y },
      data: { label: node.label, type: layer },
      type: 'custom',
    });
  });

  return { nodes, edges };
};

export const createFlowMermaid = (parsedData: any[]) => {
  const edges = new Set<string>();
  const labels = new Map<string, string>();

  parsedData.forEach((file) => {
    if (!file?.filePath || !Array.isArray(file.dependencies)) return;
    const from = sanitizeMermaidId(file.filePath);
    labels.set(from, file.filePath);
    file.dependencies.slice(0, 10).forEach((dep: string) => {
      const to = sanitizeMermaidId(dep);
      labels.set(to, dep);
      edges.add(`${from} --> ${to}`);
    });
  });

  const lines = ['graph LR'];
  Array.from(labels.entries())
    .slice(0, 50)
    .forEach(([nodeId, label]) => {
      lines.push(`${nodeId}["${label}"]`);
    });

  Array.from(edges).slice(0, 80).forEach((edge) => {
    lines.push(edge);
  });

  return lines.join('\n');
};
