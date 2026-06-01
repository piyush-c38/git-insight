import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MermaidDiagram from '@/components/mermaid-diagram';
import { PageHeader, PageShell } from '@/components/page-header';
import { fetcher } from '@/lib/api';
import { createArchitectureMermaid } from '@/lib/graph-utils';

export default function ArchitecturePage() {
  const router = useRouter();
  const { analysisId } = router.query;

  const { data, error } = useSWR(analysisId ? `/api/analysis/${analysisId}` : null, fetcher);

  if (error) return <DashboardLayout><PageShell>Failed to load analysis.</PageShell></DashboardLayout>;
  if (!data) return <DashboardLayout><PageShell>Loading...</PageShell></DashboardLayout>;
  if (data.status !== 'completed') {
    return <DashboardLayout><PageShell>Analysis in progress: {data.status}</PageShell></DashboardLayout>;
  }
  if (!data.repoUrl || !data.files) {
    return <DashboardLayout><PageShell>Analysis data is incomplete.</PageShell></DashboardLayout>;
  }

  const prefix = data.files.reduce((acc: string, current: string) => {
    if (!acc) return current;
    let i = 0;
    while (i < acc.length && i < current.length && acc[i] === current[i]) i += 1;
    return acc.slice(0, i);
  }, '');

  const relativeFiles = data.files.map((pathValue: string) =>
    pathValue.replace(prefix, '').replace(/^\//, '')
  );

  const architectureGraph = createArchitectureMermaid(
    data.repoUrl,
    relativeFiles,
    data.knowledge?.architecture ?? null
  );
  const architectureSummary = data.knowledge?.architecture?.summary;

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Visualization"
          title="Architecture overview"
          description="Logical system architecture (frontend, backend, database, integrations)."
        />
        {architectureSummary ? (
          <p className="mb-4 text-sm text-muted-foreground">{architectureSummary}</p>
        ) : null}
        <div className="rounded-2xl border border-border bg-card p-6">
          <MermaidDiagram chart={architectureGraph} />
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
