import Link from 'next/link';
import { GitFork } from 'lucide-react';

export default function MobileTopbar({ dashboardHref }: { dashboardHref?: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg" style={{ background: 'var(--gradient-primary)' }}>
          <GitFork className="size-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">GitInsight</span>
      </Link>
      {dashboardHref ? (
        <Link href={dashboardHref} className="text-xs text-muted-foreground hover:text-foreground">
          Dashboard -&gt;
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Dashboard</span>
      )}
    </div>
  );
}
