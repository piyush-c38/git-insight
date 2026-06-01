import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight, Sparkles, Square } from 'lucide-react';
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
  const progressTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const stopAnalysis = async () => {
    const activeAnalysisId = analysisId;
    clearTimers();

    if (activeAnalysisId) {
      void fetch(`/api/analysis/${activeAnalysisId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        // Best-effort cancellation; local polling has already stopped.
      });
    }

    setUrl('');
    setError(null);
    setLoading(false);
    setAnalysisId(null);
    setTargetRepoPath(null);
    setProgress(0);
  };

  useEffect(() => {
    let cancelled = false;
    if (!analysisId || !targetRepoPath) {
      cancelled = true;
      return;
    }


    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 95) return current;
        const next = current + (current < 35 ? 4 : current < 70 ? 2 : 1);
        return Math.min(next, 95);
      });
    }, 2000); 

    pollTimerRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/analysis/${analysisId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled) return;

        if (data.status === 'completed') {
          clearTimers();

          setProgress(100);
          setLoading(false);
          await router.push(`/dashboard/${analysisId}/${targetRepoPath}`);
          return;
        }

        if (data.status === 'failed' || data.status === 'cancelled') {
          clearTimers();

          setError(data.status === 'cancelled' ? 'Analysis was cancelled.' : 'Analysis failed. Please try again.');
          setLoading(false);
          setAnalysisId(null);
          setTargetRepoPath(null);
          setProgress(0);
        }
      } catch {
        // Keep polling; transient network errors should not cancel analysis flow.
      }
    }, 5000);

    return () => {
      cancelled = true;
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [analysisId, targetRepoPath, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
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

  const handlePrimaryAction = () => {
    if (loading) {
      void stopAnalysis();
      return;
    }

    void submit({ preventDefault: () => undefined } as React.FormEvent);
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
            type="button"
            onClick={handlePrimaryAction}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90',
              loading ? 'bg-destructive' : 'bg-primary'
            )}
          >
            {loading ? <Square className="size-4" /> : <ArrowRight className="size-4" />}
            <span className="hidden sm:inline">{loading ? 'Stop' : 'Explain'}</span>
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
