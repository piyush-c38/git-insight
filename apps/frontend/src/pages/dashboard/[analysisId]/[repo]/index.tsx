import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, PageShell } from '@/components/page-header';
import { fetcher } from '@/lib/api';
import { getDeclaredPackageDependencies } from '@/lib/graph-utils';
import { Boxes, FileCode2, GitFork, Star } from 'lucide-react';

function formatCount(value?: number) {
  if (typeof value !== 'number') return '--';
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
}

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

type OnboardingCard = {
  title: string;
  detail: string;
  path?: string;
  source: 'ai';
};

type RepoOnboardingSummary = {
  entryFile?: string;
  entryReason?: string;
  importantFiles?: Array<{
    path: string;
    reason: string;
  }>;
};

function parseRepoOnboardingSummary(reply: string): RepoOnboardingSummary | null {
  const jsonBlock = reply.match(/```json\s*([\s\S]*?)\s*```/i)?.[1] ?? reply.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonBlock) return null;

  try {
    return JSON.parse(jsonBlock) as RepoOnboardingSummary;
  } catch {
    return null;
  }
}

function buildFallbackSummary(files: string[]): RepoOnboardingSummary {
  const candidateEntry = files.find((file) => /(^|\/)app\/(page|layout)\.(tsx|ts|jsx|js)$|(^|\/)src\/main\.(tsx|ts|jsx|js)$|(^|\/)pages\/index\.(tsx|ts|jsx|js)$|(^|\/)pages\/.*index\.(tsx|ts|jsx|js)$|(^|\/)main\.(tsx|ts|jsx|js)$/i.test(file))
    ?? files.find((file) => /(^|\/)readme(\.[^/]+)?$/i.test(file))
    ?? files[0];

  const importantFiles = files
    .filter((file) => /readme|package\.json|tsconfig|next\.config|vite|tailwind|app\/|src\/main|pages\/index/i.test(file))
    .slice(0, 4)
    .filter((file) => file !== candidateEntry)
    .map((file) => ({
      path: file,
      reason: 'Likely influences app startup or configuration.',
    }));

  return {
    entryFile: candidateEntry,
    entryReason: 'Best local fallback based on common entry-file patterns.',
    importantFiles,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { analysisId, repo } = router.query;
  const repoParam = typeof repo === 'string' ? repo : '';
  const basePath = analysisId && repoParam ? `/dashboard/${analysisId}/${repoParam}` : '';
  const analysisKey = typeof analysisId === 'string' ? analysisId : analysisId?.[0];
  const [summary, setSummary] = useState<RepoOnboardingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const { data, error } = useSWR(analysisId ? `/api/analysis/${analysisId}` : null, fetcher, {
    refreshInterval: 5000,
  });

  const repoName = useMemo(() => {
    if (!data?.repoUrl) return 'Repository';
    return data.repoUrl.replace('https://github.com/', '');
  }, [data?.repoUrl]);

  const dependencyDetails = useMemo(() => {
    const declaredDependencies = getDeclaredPackageDependencies(
      data?.packageJson,
      data?.dependencies as Record<string, string>
    );

    return Object.values(declaredDependencies);
  }, [data?.dependencies, data?.packageJson]);

  const dependencyCount = dependencyDetails.length;

  const techStack = useMemo(() => {
    if (!Array.isArray(data?.repoMetadata?.techStack)) return [] as string[];
    return data.repoMetadata.techStack.slice(0, 12);
  }, [data?.repoMetadata?.techStack]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!analysisKey || !data?.files) return;

      setSummaryLoading(true);
      setSummaryError(null);

      const prompt = [
        'You are analyzing a GitHub repository for onboarding.',
        'Return ONLY valid JSON in this shape:',
        '{"entryFile":"path/to/entry-file","entryReason":"short reason","importantFiles":[{"path":"path/to/file","reason":"short reason"}]}',
        'Rules:',
        '- Choose the most likely first file a new contributor should open.',
        '- Describe up to 4 other important files that help understand the app.',
        '- Prefer actual repository files from the analysis.',
        '- Keep reasons short and specific.',
        `Repository files: ${(data.files as string[]).slice(0, 80).join(', ')}`,
      ].join('\n');

      try {
        const response = await fetch(`/api/analysis/${analysisKey}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt }),
        });

        if (!response.ok) {
          throw new Error('AI onboarding unavailable');
        }

        const payload = await response.json();
        const parsed = parseRepoOnboardingSummary(String(payload.reply ?? ''));

        if (!cancelled) {
          setSummary(parsed ?? buildFallbackSummary(data.files as string[]));
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(buildFallbackSummary(data.files as string[]));
          setSummaryError('AI analysis fell back to a local heuristic.');
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [analysisKey, data?.files]);

  const onboardingCards: OnboardingCard[] = useMemo(() => {
    const resolved = summary ?? buildFallbackSummary((data?.files as string[] | undefined) ?? []);
    const cards: OnboardingCard[] = [];

    if (resolved.entryFile) {
      cards.push({
        title: 'First entry file',
        detail: resolved.entryReason || 'AI-selected starting point for onboarding.',
        path: resolved.entryFile,
        source: 'ai',
      });
    }

    (resolved.importantFiles ?? []).forEach((file) => {
      cards.push({
        title: 'Important file',
        detail: file.reason,
        path: file.path,
        source: 'ai',
      });
    });

    return cards.slice(0, 5);
  }, [data?.files, summary]);

  if (error) return <DashboardLayout><PageShell>Failed to load analysis.</PageShell></DashboardLayout>;
  if (!data) return <DashboardLayout><PageShell>Loading analysis...</PageShell></DashboardLayout>;
  if (data.status !== 'completed') {
    return (
      <DashboardLayout>
        <PageShell>
          <div className="absolute top-[40%] left-[50%] mx-auto w-full translate-[-35%] flex max-w-2xl flex-col items-center gap-4 py-16 text-center">
            <div className="text-sm text-muted-foreground">Analysis in progress: {data.status}</div>
          </div>
        </PageShell>
      </DashboardLayout>
    );
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
          <Stat icon={Star} label="Stars" value={formatCount(data.repoMetadata?.stars)} />
          <Stat icon={GitFork} label="Forks" value={formatCount(data.repoMetadata?.forks)} />
          <Stat icon={FileCode2} label="Files indexed" value={data.files.length} />
          <Stat icon={Boxes} label="Dependencies" value={dependencyCount} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm font-semibold">First entry file and important files</span>
              {summaryLoading && <span className="text-xs text-muted-foreground">Analyzing with AI...</span>}
            </div>
            {summaryError && <p className="mb-3 text-xs text-muted-foreground">{summaryError}</p>}
            <ol className="space-y-3">
              {onboardingCards.map((card, index) => (
                <li key={`${card.path ?? card.title}-${index}`} className="relative flex gap-3 rounded-xl bg-secondary/50 p-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{card.title}</div>
                    {card.path && <code className="text-[11px] text-primary">{card.path}</code>}
                    <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            {!summaryLoading && onboardingCards.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">AI analysis did not return an onboarding summary.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Tech stack</h2>
            <div className="flex flex-wrap gap-2">
              {techStack.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tech stack metadata found on GitHub.</span>
              ) : (
                techStack.map((stack: string) => (
                  <span key={stack} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                    {stack}
                  </span>
                ))
              )}
            </div>

            <h2 className="mb-3 mt-6 font-semibold">Jump to</h2>
            <ul className="space-y-1.5 text-sm">
              {[
                { href: `${basePath}/files`, label: 'File Explorer' },
                { href: `${basePath}/chat`, label: 'Chat with the repo' },
                // { href: `${basePath}/architecture`, label: 'Architecture map' },
                { href: `${basePath}/dependencies`, label: 'Dependency graph' },
                // { href: `${basePath}/flow`, label: 'Data flow' },
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
