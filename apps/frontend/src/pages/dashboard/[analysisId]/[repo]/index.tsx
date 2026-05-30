import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, PageShell } from '@/components/page-header';
import { fetcher } from '@/lib/api';
import { getDeclaredPackageDependencies, type DeclaredDependency } from '@/lib/graph-utils';
import { Boxes, FileCode2, GitFork, Star } from 'lucide-react';

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { analysisId, repo } = router.query;
  const repoParam = typeof repo === 'string' ? repo : '';
  const basePath = analysisId && repoParam ? `/dashboard/${analysisId}/${repoParam}` : '';

  const { data, error } = useSWR(analysisId ? `/api/analysis/${analysisId}` : null, fetcher, {
    refreshInterval: 5000,
  });

  const repoName = useMemo(() => {
    if (!data?.repoUrl) return 'Repository';
    return data.repoUrl.replace('https://github.com/', '');
  }, [data?.repoUrl]);

  const dependenciesList = useMemo(() => {
    const declaredDependencies = getDeclaredPackageDependencies(
      data?.packageJson,
      data?.dependencies as Record<string, string>
    );

    return Object.values(declaredDependencies).slice(0, 12);
  }, [data?.dependencies, data?.packageJson]);

  const dependencyCounts = useMemo(() => {
    const declaredDependencies = getDeclaredPackageDependencies(
      data?.packageJson,
      data?.dependencies as Record<string, string>
    );

    return Object.values(declaredDependencies).reduce(
      (acc, dependency) => {
        if (dependency.category === 'dev') acc.dev += 1;
        else acc.prod += 1;
        return acc;
      },
      { prod: 0, dev: 0 }
    );
  }, [data?.dependencies, data?.packageJson]);

  const onboardingFiles = useMemo(() => {
    if (!data?.files) return [] as string[];
    const prefix = (data.files as string[]).reduce((acc: string, current: string) => {
      if (!acc) return current;
      let i = 0;
      while (i < acc.length && i < current.length && acc[i] === current[i]) i += 1;
      return acc.slice(0, i);
    }, '');

    return (data.files as string[])
      .map((pathValue: string) => pathValue.replace(prefix, '').replace(/^\//, ''))
      .slice(0, 5);
  }, [data?.files]);

  if (error) return <DashboardLayout><PageShell>Failed to load analysis.</PageShell></DashboardLayout>;
  if (!data) return <DashboardLayout><PageShell>Loading analysis...</PageShell></DashboardLayout>;
  if (data.status !== 'completed') {
    return <DashboardLayout><PageShell>Analysis in progress: {data.status}</PageShell></DashboardLayout>;
  }
  if (!data.repoUrl || !data.files) {
    return <DashboardLayout><PageShell>Analysis data is incomplete.</PageShell></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="Repository"
          title={repoName}
          description={`Analysis complete for ${repoName}.`}
          actions={
            <a
              href={data.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-secondary"
            >
              View on GitHub
            </a>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Stat icon={Star} label="Stars" value="--" />
          <Stat icon={GitFork} label="Forks" value="--" />
          <Stat icon={FileCode2} label="Files indexed" value={data.files.length} />
          <Stat icon={Boxes} label="Dependencies" value={dependenciesList.length} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm font-semibold">Onboarding path</span>
            </div>
            <ol className="space-y-3">
              {onboardingFiles.map((file, index) => (
                <li key={file} className="flex gap-3 rounded-xl bg-secondary/50 p-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Start here</div>
                    <code className="text-[11px] text-primary">{file}</code>
                    <p className="mt-1 text-sm text-muted-foreground">
                      High-signal file from the repo structure.
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Tech stack</h2>
            <div className="flex flex-wrap gap-2">
              {dependenciesList.length === 0 ? (
                <span className="text-sm text-muted-foreground">No package.json dependencies detected.</span>
              ) : (
                dependenciesList.map((dep: DeclaredDependency) => (
                  <span key={dep.name} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                    {dep.name} {dep.version}
                  </span>
                ))
              )}
            </div>

            <h2 className="mb-3 mt-6 font-semibold">Jump to</h2>
            <ul className="space-y-1.5 text-sm">
              {[
                { href: `${basePath}/files`, label: 'File Explorer' },
                { href: `${basePath}/chat`, label: 'Chat with the repo' },
                { href: `${basePath}/architecture`, label: 'Architecture map' },
                { href: `${basePath}/dependencies`, label: 'Dependency graph' },
                { href: `${basePath}/flow`, label: 'Data flow' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                    -&gt; {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
