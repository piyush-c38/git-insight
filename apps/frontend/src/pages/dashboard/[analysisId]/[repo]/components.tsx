import { useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ReactFlowGraph from '@/components/visualization/ReactFlowGraph';
import { fetcher } from '@/lib/api';
import { createComponentRelationshipGraph } from '@/lib/graph-utils';

export default function ComponentsPage() {
  const router = useRouter();
  const { analysisId } = router.query;

  const { data: analysisData, error: analysisError } = useSWR(
    analysisId ? `/api/analysis/${analysisId}` : null,
    fetcher
  );

  const graphData = useMemo(() => {
    if (!analysisData?.analysis?.parsedData) return { nodes: [], edges: [] };
    return createComponentRelationshipGraph(analysisData.analysis.parsedData);
  }, [analysisData]);

  if (analysisError) return <DashboardLayout><div>Failed to load analysis.</div></DashboardLayout>;
  if (!analysisData) return <DashboardLayout><div>Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-primary mb-4">Component Relationship Graph</h1>
      <div className="h-[calc(100vh-10rem)]">
        <ReactFlowGraph nodes={graphData.nodes} edges={graphData.edges} />
      </div>
    </DashboardLayout>
  );
}
