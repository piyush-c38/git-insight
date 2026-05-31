import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { encodeRepoPath } from '@/lib/routes';

interface Props {
  className?: string;
  autoFocus?: boolean;
}

export default function RepoInput({ className, autoFocus }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [targetRepoPath, setTargetRepoPath] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!analysisId || !targetRepoPath) return;

    let cancelled = false;

    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 95) return current;
        const next = current + (current < 35 ? 4 : current < 70 ? 2 : 1);
        return Math.min(next, 95);
      });
    }, 700);

    const pollTimer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/analysis/${analysisId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled) return;

        if (data.status === 'completed') {
          window.clearInterval(progressTimer);
          window.clearInterval(pollTimer);
          setProgress(100);
          setLoading(false);
          await router.push(`/dashboard/${analysisId}/${targetRepoPath}`);
          return;
        }

        if (data.status === 'failed') {
          window.clearInterval(progressTimer);
          window.clearInterval(pollTimer);
          setError('Analysis failed. Please try again.');
          setLoading(false);
          setAnalysisId(null);
          setTargetRepoPath(null);
          setProgress(0);
        }
      } catch {
        // Keep polling; transient network errors should not cancel analysis flow.
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
      window.clearInterval(pollTimer);
    };
  }, [analysisId, targetRepoPath, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (!/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(trimmed)) {
      setError('Please paste a valid GitHub repo URL (https://github.com/owner/repo).');
      return;
    }

    try {
      setLoading(true);
      setProgress(8);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: trimmed }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis.');
      }

      const data = await response.json();
      const repoPath = trimmed.replace('https://github.com/', '');
      const encodedRepo = encodeRepoPath(repoPath);

      setTargetRepoPath(encodedRepo);
      setAnalysisId(data.analysisId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setLoading(false);
      setProgress(0);
    } finally {
      // Loading is finalized by polling flow.
    }
  };

  return (
    <form onSubmit={submit} className={cn('w-full', className)}>
      <div className="group relative rounded-2xl p-px transition-all" style={{ background: 'var(--gradient-primary)' }}>
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3">
          <Sparkles className="size-5 shrink-0 text-primary" />
          <input
            autoFocus={autoFocus}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a GitHub repo URL — e.g. https://github.com/vercel/next-commerce"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground md:text-base"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            <span className="hidden sm:inline">{loading ? 'Analyzing' : 'Explain'}</span>
          </button>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary/60">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, opacity: loading || progress > 0 ? 1 : 0 }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
