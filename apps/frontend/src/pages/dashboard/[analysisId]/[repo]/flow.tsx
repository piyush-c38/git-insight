import DashboardLayout from '@/components/layout/DashboardLayout';
import MermaidRenderer from '@/components/visualization/MermaidRenderer';

const dataFlowGraph = `
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Git
    participant Groq

    User->>Frontend: Enters GitHub URL
    Frontend->>Backend: /api/analysis (repoUrl)
    Backend->>Git: Clone repository
    Backend->>Backend: Analyze files (tree-sitter)
    Backend->>Frontend: Returns analysisId
    
    User->>Frontend: Navigates to dashboard
    Frontend->>Backend: /api/analysis/{analysisId}
    Backend->>Frontend: Returns analysis data

    User->>Frontend: Asks a question in chat
    Frontend->>Backend: /api/chat (question, analysisId)
    Backend->>Groq: Generates response via RAG
    Groq-->>Backend: Response
    Backend-->>Frontend: Streams response
    Frontend-->>User: Displays response
`;

export default function FlowPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-primary mb-4">Request/Data Flow</h1>
      <div className="h-[calc(100vh-10rem)] bg-surface-1 p-4 rounded-lg border border-outline">
        <MermaidRenderer chart={dataFlowGraph} />
      </div>
    </DashboardLayout>
  );
}
