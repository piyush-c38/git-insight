import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, PageShell } from '@/components/page-header';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Msg = { role: 'user' | 'assistant'; content: string };

type AnalysisData = {
  repoUrl?: string;
  files?: string[];
  packageJson?: {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  repoMetadata?: {
    techStack?: string[];
  };
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-2 text-base font-semibold text-foreground">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold text-foreground">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 text-sm font-semibold text-foreground">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="rounded bg-background/80 px-1.5 py-0.5 text-[0.85em] text-foreground" {...props}>
                {children}
              </code>
            );
          }

          return (
            <pre className="mb-2 overflow-x-auto rounded-xl border border-border bg-background/80 p-3 text-xs text-foreground last:mb-0">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">{children}</blockquote>
        ),
        hr: () => <hr className="my-3 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function buildSampleQuestions(data?: AnalysisData): string[] {
  const repoName = 'this repository';
  const firstTech = data?.repoMetadata?.techStack?.[0];
  const depNames = Object.keys(data?.packageJson?.dependencies || {});
  const topDependency = depNames[0];
  const hasBuildScript = Boolean(data?.packageJson?.scripts?.build);
  const hasTestScript = Boolean(data?.packageJson?.scripts?.test);
  const firstFile = data?.files?.[0]?.split('/').pop();

  const questions = [
    `Explain the architecture of ${repoName}.`,
    firstTech ? `What is the tech stack of ${repoName}?` : 'What technologies is this project built with?',
    topDependency
      ? `What dependencies are used and why is ${topDependency} included?`
      : 'What are the main dependencies and how are they categorized?',
    hasBuildScript
      ? 'How do I get started and run this project locally?'
      : hasTestScript
        ? 'How is testing set up and where are the main tests?'
        : firstFile
          ? `Where is ${firstFile} used and explain the login flow.`
          : 'Explain the main request flow from entry point to output.',
  ];

  return questions.slice(0, 4);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { analysisId } = router.query;
  const analysisIdParam = Array.isArray(analysisId) ? analysisId[0] : analysisId;

  const { data } = useSWR<AnalysisData>(
    analysisIdParam ? `/api/analysis/${analysisIdParam}` : null,
    fetcher
  );

  const sampleQuestions = buildSampleQuestions(data);

  useEffect(() => {
    if (!analysisIdParam || messages.length > 0 || !data?.repoUrl) return;
    const repoName = data.repoUrl.replace('https://github.com/', '');
    setMessages([
      {
        role: 'assistant',
        content: `Hi! I indexed ${repoName}. Ask about architecture, tech stack, features, or how a flow works. I will cite sources from files and links.`,
      },
    ]);
  }, [analysisIdParam, data?.repoUrl, messages.length]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (!analysisIdParam) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: analysisIdParam, query: text }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          eyebrow="AI Chat"
          title="Ask the repository anything"
          description="Grounded in the repo's files via RAG."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex h-150 flex-col rounded-2xl border border-border bg-card">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div
                      className="grid size-8 shrink-0 place-items-center rounded-lg"
                      style={{ background: 'var(--gradient-primary)' }}
                    >
                      <span className="text-xs text-primary-foreground">AI</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl wrap-break-word px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {msg.role === 'assistant' ? <MarkdownMessage content={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="grid size-8 place-items-center rounded-lg" style={{ background: 'var(--gradient-primary)' }}>
                    <span className="text-xs text-primary-foreground">AI</span>
                  </div>
                  <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
              className="flex gap-2 border-t border-border p-3"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about architecture, files, flows..."
                className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                disabled={!analysisIdParam}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                disabled={!input.trim() || isLoading || !analysisIdParam}
              >
                Send
              </button>
            </form>
          </div>

          <aside className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Try asking</div>
            {sampleQuestions.map((question) => (
              <button
                key={question}
                onClick={() => send(question)}
                className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm transition hover:bg-secondary"
                disabled={!analysisIdParam}
              >
                {question}
              </button>
            ))}
          </aside>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
