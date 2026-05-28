import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

export default function MermaidRenderer({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (chart && ref.current) {
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
      mermaid
        .render(idRef.current, chart)
        .then(({ svg }) => {
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Mermaid render failed:', error);
        });
    }
  }, [chart]);

  if (!chart) return null;

  return <div ref={ref} />;
}
