import DashboardLayout from '@/components/layout/DashboardLayout';
import MermaidRenderer from '@/components/visualization/MermaidRenderer';

const architectureGraph = `
graph TD
    A[Client] --> B{Next.js Frontend};
    B --> C{API Routes};
    C --> D[Express Backend];
    D --> E[Analysis Service];
    E --> F[Git Service];
    E --> G[Parser Service];
    G --> H[Tree-sitter];
    D --> I[RAG Service];
    I --> J[ChromaDB];
    I --> K[Groq API];
`;

export default function ArchitecturePage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-primary mb-4">Architecture Overview</h1>
      <div className="h-[calc(100vh-10rem)] bg-surface-1 p-4 rounded-lg border border-outline">
        <MermaidRenderer chart={architectureGraph} />
      </div>
    </DashboardLayout>
  );
}
