import { useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, PageShell } from '@/components/page-header';
import { GraphCanvas, nodeStyle, nodeStylePrimary } from '@/components/graph-canvas';
import { fetcher } from '@/lib/api';
import {
  createDependencyGraph,
  getDeclaredPackageDependencies,
  type DeclaredDependency,
} from '@/lib/graph-utils';
import type { Edge, Node } from 'reactflow';

export default function DependenciesPage() {
  const router = useRouter();
  const { analysisId } = router.query;

  const { data: analysisData, error: analysisError } = useSWR(
    analysisId ? `/api/analysis/${analysisId}` : null,
    fetcher
  );

  const { nodes, edges, list } = useMemo(() => {
    const declaredDependencies = getDeclaredPackageDependencies(
      analysisData?.packageJson,
      analysisData?.dependencies as Record<string, string>
    );

    if (Object.keys(declaredDependencies).length === 0) {
      return { nodes: [] as Node[], edges: [] as Edge[], list: [] as string[] };
    }

    const { nodes: graphNodes, edges: graphEdges } = createDependencyGraph(
      declaredDependencies,
      analysisData.packageJson
    );

    const deps = Object.values(declaredDependencies);
    const nodes = graphNodes.map((node, index) => ({
      ...node,
      style: index === 0 ? nodeStylePrimary : nodeStyle,
    }));

    return { nodes, edges: graphEdges, list: deps };
  }, [analysisData]) as { nodes: Node[]; edges: Edge[]; list: DeclaredDependency[] };

  if (analysisError) return <DashboardLayout><PageShell>Failed to load analysis.</PageShell></DashboardLayout>;
  if (!analysisData) return <DashboardLayout><PageShell>Loading...</PageShell></DashboardLayout>;
  if (analysisData.status !== 'completed') {
    return <DashboardLayout><PageShell>Analysis in progress: {analysisData.status}</PageShell></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Visualization"
          title="Dependency graph"
          description="Dependencies declared in the analyzed repo's package.json."
        />
        <GraphCanvas nodes={nodes} edges={edges} height={600} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No dependencies detected.
            </div>
          ) : (
            list.map((dep: DeclaredDependency) => (
              <div key={dep.name} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <div className="text-sm font-medium">{dep.name}</div>
                  <div className="text-xs text-muted-foreground">{dep.version}</div>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {dep.category}
                </span>
              </div>
            ))
          )}
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
