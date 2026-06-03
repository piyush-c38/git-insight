import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  MessagesSquare,
  FolderTree,
  Network,
  Boxes,
  GitBranch,
  Workflow,
  Sparkles,
  GitFork,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnalysis } from '@/lib/api';

type SidebarItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
};

const groups: { label: string; items: SidebarItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { id: 'home', label: 'Home', icon: Sparkles, href: '/' },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessagesSquare },
      { id: 'files', label: 'File Explorer', icon: FolderTree },
    ],
  },
  {
    label: 'Visualizations',
    items: [
      { id: 'structure', label: 'Folder Structure', icon: FolderTree },
      { id: 'dependencies', label: 'Dependencies', icon: Boxes },
      // { id: 'components', label: 'Components', icon: Network },
      // { id: 'flow', label: 'Data Flow', icon: Workflow },
      // { id: 'architecture', label: 'Architecture', icon: GitBranch },
    ],
  },
] as const;

export default function AppSidebar() {
  const router = useRouter();
  const { analysisId, repo } = router.query;
  const repoParam = typeof repo === 'string' ? repo : '';
  const pathMatch = router.asPath.match(/\/dashboard\/([^/]+)\/([^/?#]+)/);
  const resolvedAnalysisId = typeof analysisId === 'string' ? analysisId : pathMatch?.[1];
  const resolvedRepo = repoParam || pathMatch?.[2] || '';
  const basePath = resolvedAnalysisId && resolvedRepo ? `/dashboard/${resolvedAnalysisId}/${resolvedRepo}` : '';

  const { analysis } = useAnalysis(resolvedAnalysisId);
  const isProcessing = analysis?.status === 'processing';
  const isHomeActive = router.asPath === '/';
  const homeLabel = isHomeActive ? 'Home' : 'New analysis';

  function handleContact() {
    if (typeof window === 'undefined') return;
    // Open default mail client with a prefilled recipient
    window.location.href = 'mailto:piyushch.ofc@gmail.com';
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="border-b border-sidebar-border px-5 py-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <div
            className="grid size-9 place-items-center rounded-xl shadow-(--shadow-glow)"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <GitFork className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">GitInsight</div>
            <div className="text-[11px] text-muted-foreground">AI Repo Explainer</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const href = item.href
                  ? item.href
                  : basePath
                    ? `${basePath}/${item.id === 'dashboard' ? '' : item.id}`.replace(/\/$/, '')
                    : '';
                const active = href && router.asPath === href;
                const Icon = item.icon;
                const displayLabel = item.id === 'home' ? homeLabel : item.label;
                const isHomeItem = item.id === 'home';

                // While analysis is processing, keep only the new-analysis entry clickable.
                if (isProcessing && !isHomeItem) {
                  return (
                    <li key={item.id}>
                      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/60 opacity-60">
                        <Icon className="size-4" />
                        <span>{displayLabel}</span>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={item.id}>
                    {href ? (
                      <Link
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                        )}
                      >
                        <Icon className="size-4" />
                        <span>{displayLabel}</span>
                        {active && (
                          <span className="ml-auto size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                        )}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/60">
                        <Icon className="size-4" />
                        <span>{displayLabel}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="text-xs font-medium">Project MVP</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Hey! This is a MVP version of GitExplainer. Feedbacks are appreciated.
            <div className='place-items-end'>
              <div
                className="mt-2 grid size-10 place-items-center rounded-xl border border-border bg-card cursor-pointer"
                onClick={handleContact}
                role="button"
                aria-label="Contact via email"
              >
                <MessagesSquare className="size-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
