import { useEffect, useRef, useState } from 'react';

export default function MermaidRenderer({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !chart || !ref.current) return;

    let isCancelled = false;

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          themeVariables: {
            primaryColor: '#8AB4F8',
            mainBkg: '#1E1F20',
            textColor: '#E3E3E3',
          },
        });

        const { svg } = await mermaid.render(idRef.current, chart);
        if (!isCancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Mermaid render failed:', error);
      }
    };

    render();
    return () => {
      isCancelled = true;
    };
  }, [chart, isClient]);

  if (!chart) return null;

  return <div ref={ref} className="min-h-50" />;
}
