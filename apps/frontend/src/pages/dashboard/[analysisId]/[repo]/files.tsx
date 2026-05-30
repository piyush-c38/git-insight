import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Clipboard, Check } from 'lucide-react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, PageShell } from '@/components/page-header';
import { fetcher } from '@/lib/api';
import { buildTree, normalizeFilePaths, type RepoFile } from '@/lib/file-tree';
import { ChevronRight, FileText, Folder, FolderOpen, Star } from 'lucide-react';

function Tree({ node, depth = 0, onSelect, selected }: { node: RepoFile; depth?: number; onSelect: (f: RepoFile) => void; selected: string }) {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = node.type === 'folder';
  const active = selected === node.path;

  if (node.path === '') {
    return (
      <div>
        {node.children?.map((child) => (
          <Tree key={child.path} node={child} depth={0} onSelect={onSelect} selected={selected} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          if (isFolder) setOpen((prev) => !prev);
          else onSelect(node);
        }}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/60 ${active ? 'bg-secondary' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {isFolder ? (
          <ChevronRight className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3.5" />
        )}
        {isFolder ? (
          open ? <FolderOpen className="size-4 text-primary" /> : <Folder className="size-4 text-primary" />
        ) : (
          <FileText className="size-4 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
        {node.important && <Star className="ml-auto size-3 text-accent" />}
      </button>
      {isFolder && open && node.children?.map((child) => (
        <Tree key={child.path} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  );
}

export default function FilesPage() {
  const router = useRouter();
  const { analysisId } = router.query;
  const [selected, setSelected] = useState<RepoFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: analysisData, error: analysisError } = useSWR(
    analysisId ? `/api/analysis/${analysisId}` : null,
    fetcher
  );

  useEffect(() => {
    let cancelled = false;
    async function loadFile() {
      if (!selected || !analysisId) return;
      setFileLoading(true);
      setFileError(null);
      setFileContent(null);
      try {
        const id = Array.isArray(analysisId) ? analysisId[0] : analysisId;
        const res = await fetch(`/api/analysis/${id}/file?path=${encodeURIComponent(selected.path)}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.message || 'Failed to fetch file');
        }
        const json = await res.json();
        if (!cancelled) setFileContent(json.content ?? null);
      } catch (err: any) {
        if (!cancelled) setFileError(err.message || 'Failed to load file');
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    }

    loadFile();
    return () => { cancelled = true; };
  }, [selected, analysisId]);

  const tree = useMemo(() => {
    if (!analysisData?.files) return null;
    const normalized = normalizeFilePaths(analysisData.files);
    return buildTree(normalized);
  }, [analysisData]);

  if (analysisError) return <DashboardLayout><PageShell>Failed to load analysis.</PageShell></DashboardLayout>;
  if (!analysisData) return <DashboardLayout><PageShell>Loading...</PageShell></DashboardLayout>;
  if (analysisData.status !== 'completed') {
    return <DashboardLayout><PageShell>Analysis in progress: {analysisData.status}</PageShell></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader eyebrow="Files" title="File Explorer" description="Browse the repo. Important files are starred." />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="max-h-140 overflow-y-auto rounded-2xl border border-border bg-card p-3 min-w-0">
            {tree ? (
              <Tree node={tree} onSelect={setSelected} selected={selected?.path ?? ''} />
            ) : (
              <div className="text-sm text-muted-foreground">No files found.</div>
            )}
          </div>
          <div className="min-h-100 max-h-140 min-w-0 rounded-2xl border border-border bg-card p-6">
            {selected ? (
              <div>
                <div className="text-xs text-muted-foreground">{selected.path}</div>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
                  {selected.name}
                  {selected.important && <Star className="size-4 text-accent" />}
                </h2>

                {fileLoading && <div className="mt-5 text-sm text-muted-foreground">Loading file...</div>}
                {fileError && <div className="mt-5 text-sm text-destructive">{fileError}</div>} 

                {!fileLoading && !fileError && fileContent !== null && (
                  <div className='relative -top-5'>
                    <div className=" mb-2 flex items-center justify-end gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(fileContent);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (e) {
                            console.error('Copy failed', e);
                          }
                        }}
                        className="flex items-center gap-2 rounded-md bg-muted/10 px-3 py-1 text-sm hover:text-primary"
                      >
                        {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto max-w-full max-h-110 rounded-xl border border-border bg-secondary/50 text-sm">
                      <SyntaxHighlighterWrapper code={fileContent} fileName={selected.name} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                Select a file to see details.
              </div>
            )}
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then((mod) => mod.Prism),
  { ssr: false }
);

import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function getLanguageFromFilename(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'tsx';
    case 'js':
    case 'jsx':
      return 'jsx';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    default:
      return 'text';
  }
}

function SyntaxHighlighterWrapper({ code, fileName }: { code: string; fileName: string }) {
  const lang = getLanguageFromFilename(fileName);
  return (
    <div className="overflow-x-auto">
      {(() => {
        const S: any = SyntaxHighlighter as any;
        return <S language={lang} style={oneDark} customStyle={{ margin: 0, padding: '1rem' }}>{code}</S>;
      })()}
    </div>
  );
}
