export type DependencyCategory =
  | 'Frontend'
  | 'UI'
  | 'Backend'
  | 'Database'
  | 'Authentication'
  | 'State Management'
  | 'Testing'
  | 'Build Tools'
  | 'Monitoring'
  | 'Networking'
  | 'AI/ML'
  | 'Utilities'
  | 'Other';

export interface ClassifiedDependency {
  name: string;
  version: string;
  category: DependencyCategory;
  explanation: string;
  source: string;
}

export interface DependencySummary {
  generatedAt: string;
  manifestFiles: string[];
  totalDependencies: number;
  byCategory: Record<DependencyCategory, ClassifiedDependency[]>;
  highlights: string[];
  summary: string;
}

export interface TechStackLayer {
  name: string;
  technologies: string[];
  evidence: string[];
}

export interface TechStackKnowledge {
  generatedAt: string;
  primaryLanguage: string;
  languages: string[];
  frontend: TechStackLayer | null;
  backend: TechStackLayer | null;
  database: TechStackLayer | null;
  runtime: TechStackLayer | null;
  tooling: TechStackLayer[];
  summary: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  layer: 'frontend' | 'backend' | 'database' | 'external' | 'shared';
  type: string;
  children?: string[];
  filePaths?: string[];
}

export interface ArchitectureKnowledge {
  generatedAt: string;
  frontend: {
    framework: string | null;
    components: string[];
    pages: string[];
    services: string[];
    stateManagement: string[];
    entryPoints: string[];
  };
  backend: {
    framework: string | null;
    routes: string[];
    controllers: string[];
    services: string[];
    middleware: string[];
    apiLayers: string[];
    entryPoints: string[];
  };
  database: {
    orm: string | null;
    drivers: string[];
    models: string[];
    migrations: string[];
  };
  externalServices: {
    name: string;
    purpose: string;
    evidence: string[];
  }[];
  authentication: {
    strategy: string | null;
    libraries: string[];
    flows: string[];
  };
  dataFlow: string[];
  diagram: {
    nodes: ArchitectureNode[];
    edges: { from: string; to: string; label?: string }[];
    mermaid: string;
  };
  summary: string;
}

export interface OnboardingKnowledge {
  generatedAt: string;
  prerequisites: string[];
  setupSteps: string[];
  environmentVariables: string[];
  scripts: { name: string; command: string; purpose: string }[];
  projectStructure: string[];
  commonTasks: string[];
  summary: string;
}

export interface RepositorySummaryKnowledge {
  generatedAt: string;
  purpose: string;
  mainModules: { name: string; description: string; path: string }[];
  coreFeatures: string[];
  keyWorkflows: string[];
  entryPoints: { path: string; role: string }[];
  summary: string;
}

export interface RepositoryKnowledge {
  architecture: ArchitectureKnowledge;
  dependencySummary: DependencySummary;
  techStack: TechStackKnowledge;
  onboarding: OnboardingKnowledge;
  repositorySummary: RepositorySummaryKnowledge;
}

export type ChatIntent =
  | 'architecture'
  | 'dependency'
  | 'tech_stack'
  | 'onboarding'
  | 'repository_summary'
  | 'code';
