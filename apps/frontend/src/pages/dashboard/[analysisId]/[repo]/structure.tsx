import { useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, PageShell } from '@/components/page-header';
import { GraphCanvas, nodeStyle, nodeStylePrimary } from '@/components/graph-canvas';
import { fetcher } from '@/lib/api';
import { buildTree, normalizeFilePaths, type RepoFile } from '@/lib/file-tree';
import type { Edge, Node } from 'reactflow';

function buildGraph(root: RepoFile) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const levels: Record<number, number> = {};

  function walk(node: RepoFile, depth: number, parentId?: string) {
    const index = (levels[depth] = (levels[depth] ?? -1) + 1);
    const id = node.path;
    nodes.push({
      id,
      position: { x: depth * 240, y: index * 80 },
      data: { label: node.name + (node.type === 'folder' ? '/' : '') },
      style: depth === 0 ? nodeStylePrimary : nodeStyle,
    });
    if (parentId) {
      edges.push({ id: `${parentId}->${id}`, source: parentId, target: id });
    }
    node.children?.forEach((child) => walk(child, depth + 1, id));
  }

  walk(root, 0);
  return { nodes, edges };
}

export default function StructurePage() {
  const router = useRouter();
  const { analysisId } = router.query;

  const { data, error } = useSWR(analysisId ? `/api/analysis/${analysisId}` : null, fetcher);

  const graph = useMemo(() => {
    if (!data?.files) return { nodes: [], edges: [] };
    const normalized = normalizeFilePaths(data.files);
    const tree = buildTree(normalized);
    return buildGraph(tree);
  }, [data]);

  if (error) return <DashboardLayout><PageShell>Failed to load analysis.</PageShell></DashboardLayout>;
  if (!data) return <DashboardLayout><PageShell>Loading...</PageShell></DashboardLayout>;
  if (data.status !== 'completed') {
    return <DashboardLayout><PageShell>Analysis in progress: {data.status}</PageShell></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Visualization"
          title="Folder structure"
          description="Top-level layout of the repository as an interactive graph."
        />
        <GraphCanvas nodes={graph.nodes} edges={graph.edges} height={600}/>
      </PageShell>
    </DashboardLayout>
  );
}
