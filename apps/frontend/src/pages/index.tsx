import RepoInput from '@/components/repo-input';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Boxes, GitBranch, MessagesSquare, Network, Sparkles, Workflow } from 'lucide-react';

const features = [
  // { icon: GitBranch, title: 'Architecture overview', body: 'High-level system map of the repo.' },
  { icon: Boxes, title: 'Dependency graph', body: "What's installed, and who uses what." },
  // { icon: Network, title: 'Component relationships', body: 'See how files import each other.' },
  // { icon: Workflow, title: 'Data and request flow', body: 'Trace a request from UI to DB.' },
  { icon: Sparkles, title: 'Onboarding path', body: 'The important notes a new contributor should read.' },
  { icon: MessagesSquare, title: 'Chat with the repo', body: 'Ask anything in plain English.' },
];

export default function Home() {
  return (
    <DashboardLayout>
      <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-130 opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, oklch(0.72 0.16 250 / 0.25) 0%, transparent 60%), radial-gradient(40% 40% at 80% 10%, oklch(0.7 0.18 320 / 0.18) 0%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center md:px-8 md:pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          AI GitHub Repository Explainer
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
          Understand any GitHub repo
          <br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>
            in minutes, not weekends.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
           Paste a repo URL. Get a dependency graph, important files, code flow,
          and a chat that knows the codebase.
          {/* Paste a repo URL. Get an architecture map, dependency graph, important files, code flow,
          and a chat that knows the codebase. */}
        </p>

        <div className="mx-auto mt-10 max-w-2xl">
          <RepoInput autoFocus />
        </div>

        {/* <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Try:</span>
          {['vercel/next.js', 'shadcn-ui/ui', 'facebook/react'].map((repo) => (
            <span key={repo} className="rounded-full border border-border bg-card px-2.5 py-1">
              {repo}
            </span>
          ))}
        </div> */}
      </div>

      <section className="mx-auto max-w-7xl px-5 pb-2 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:bg-card"
              >
                <div className="mb-4 grid size-10 place-items-center rounded-xl" style={{ background: 'var(--gradient-primary)' }}>
                  <Icon className="size-5 text-primary-foreground" />
                </div>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
    </DashboardLayout>
  );
}
