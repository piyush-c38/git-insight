import {
  ArchitectureKnowledge,
  ArchitectureNode,
} from '../../types/knowledge';
import { DependencySummary } from '../../types/knowledge';
import {
  ParsedFileRecord,
  collectByRole,
  detectFrameworks,
  findEntryPoints,
  getTopLevelFolders,
  inferRoleFromPath,
  normalizeRelativePath,
  uniqueSymbols,
} from '../../lib/repo-structure';

const MAX_DIAGRAM_NODES = 48;

function sanitizeMermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
}

function buildLogicalDiagram(
  arch: Omit<ArchitectureKnowledge, 'diagram' | 'summary' | 'generatedAt'>
): { nodes: ArchitectureNode[]; edges: { from: string; to: string; label?: string }[]; mermaid: string } {
  const nodes: ArchitectureNode[] = [];
  const edges: { from: string; to: string; label?: string }[] = [];

  const addNode = (id: string, label: string, layer: ArchitectureNode['layer'], type: string, children?: string[]) => {
    if (nodes.some((n) => n.id === id)) return;
    nodes.push({ id, label, layer, type, children });
  };

  addNode('client', 'Client / Browser', 'frontend', 'client');
  addNode('frontend_root', 'Frontend', 'frontend', 'layer');

  if (arch.frontend.framework) {
    addNode('fe_framework', arch.frontend.framework, 'frontend', 'framework');
    edges.push({ from: 'client', to: 'fe_framework' });
    edges.push({ from: 'fe_framework', to: 'frontend_root' });
  } else {
    edges.push({ from: 'client', to: 'frontend_root' });
  }

  if (arch.frontend.pages.length) {
    addNode('fe_pages', `Pages (${arch.frontend.pages.length})`, 'frontend', 'pages');
    edges.push({ from: 'frontend_root', to: 'fe_pages' });
  }
  if (arch.frontend.components.length) {
    addNode('fe_components', `Components (${arch.frontend.components.length})`, 'frontend', 'components');
    edges.push({ from: 'frontend_root', to: 'fe_components' });
  }
  if (arch.frontend.services.length) {
    addNode('fe_services', `Client Services (${arch.frontend.services.length})`, 'frontend', 'services');
    edges.push({ from: 'frontend_root', to: 'fe_services' });
  }
  if (arch.frontend.stateManagement.length) {
    addNode('fe_state', arch.frontend.stateManagement.join(', '), 'frontend', 'state');
    edges.push({ from: 'frontend_root', to: 'fe_state' });
  }

  addNode('backend_root', 'Backend', 'backend', 'layer');
  if (arch.backend.framework) {
    addNode('be_framework', arch.backend.framework, 'backend', 'framework');
    edges.push({ from: 'frontend_root', to: 'be_framework', label: 'HTTP/API' });
    edges.push({ from: 'be_framework', to: 'backend_root' });
  } else {
    edges.push({ from: 'frontend_root', to: 'backend_root', label: 'API' });
  }

  let lastBackendNode = 'backend_root';
  if (arch.backend.routes.length) {
    addNode('be_routes', `Routes (${arch.backend.routes.length})`, 'backend', 'routes');
    edges.push({ from: lastBackendNode, to: 'be_routes' });
    lastBackendNode = 'be_routes';
  }
  if (arch.backend.controllers.length) {
    addNode('be_controllers', `Controllers (${arch.backend.controllers.length})`, 'backend', 'controllers');
    edges.push({ from: lastBackendNode, to: 'be_controllers', label: 'handles' });
    lastBackendNode = 'be_controllers';
  }
  if (arch.backend.services.length) {
    addNode('be_services', `Services (${arch.backend.services.length})`, 'backend', 'services');
    edges.push({ from: lastBackendNode, to: 'be_services', label: 'delegates' });
    lastBackendNode = 'be_services';
  }
  if (arch.backend.middleware.length) {
    addNode('be_middleware', `Middleware (${arch.backend.middleware.length})`, 'backend', 'middleware');
    edges.push({ from: 'backend_root', to: 'be_middleware' });
  }

  if (arch.database.orm || arch.database.models.length || arch.database.drivers.length) {
    addNode('database', 'Database Layer', 'database', 'database');
    const dbSource = nodes.some((n) => n.id === 'be_services') ? 'be_services' : lastBackendNode;
    edges.push({ from: dbSource, to: 'database', label: 'persist' });
    if (arch.database.orm) {
      addNode('db_orm', arch.database.orm, 'database', 'orm');
      edges.push({ from: 'database', to: 'db_orm' });
    }
  }

  for (const ext of arch.externalServices.slice(0, 4)) {
    const id = sanitizeMermaidId(`ext_${ext.name}`);
    addNode(id, ext.name, 'external', 'integration');
    edges.push({ from: 'backend_root', to: id, label: ext.purpose });
  }

  if (arch.authentication.strategy || arch.authentication.libraries.length) {
    addNode('auth', arch.authentication.strategy ?? 'Authentication', 'shared', 'auth');
    edges.push({ from: 'backend_root', to: 'auth' });
  }

  const trimmedNodes = nodes.slice(0, MAX_DIAGRAM_NODES);
  const nodeIds = new Set(trimmedNodes.map((n) => n.id));
  const trimmedEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  const lines = ['graph TD'];
  for (const node of trimmedNodes) {
    const id = sanitizeMermaidId(node.id);
    lines.push(`${id}["${node.label.replace(/"/g, "'")}"]`);
  }
  for (const edge of trimmedEdges) {
    const from = sanitizeMermaidId(edge.from);
    const to = sanitizeMermaidId(edge.to);
    if (edge.label) {
      lines.push(`${from} -->|${edge.label}| ${to}`);
    } else {
      lines.push(`${from} --> ${to}`);
    }
  }

  return { nodes: trimmedNodes, edges: trimmedEdges, mermaid: lines.join('\n') };
}

class ArchitectureGeneratorService {
  generate(
    relativeFiles: string[],
    parsedData: ParsedFileRecord[],
    dependencySummary: DependencySummary
  ): ArchitectureKnowledge {
    const allDepNames = new Set(
      Object.values(dependencySummary.byCategory)
        .flat()
        .map((d) => d.name)
    );

    const { frontend: frontendFramework, backend: backendFramework } = detectFrameworks(relativeFiles, allDepNames);

    const stateLibs = dependencySummary.byCategory['State Management'].map((d) => d.name);
    const authLibs = dependencySummary.byCategory.Authentication.map((d) => d.name);
    const dbLibs = dependencySummary.byCategory.Database.map((d) => d.name);

    const frontend = {
      framework: frontendFramework,
      components: collectByRole(relativeFiles, 'component'),
      pages: collectByRole(relativeFiles, 'page'),
      services: collectByRole(relativeFiles, 'service').filter((n) =>
        relativeFiles.some((f) => /frontend|client|web/i.test(f) && f.includes(n))
      ),
      stateManagement: stateLibs,
      entryPoints: findEntryPoints(relativeFiles).filter((ep) =>
        /frontend|pages|components|client|web/i.test(ep) || ep.includes('pages/')
      ),
    };

    const backend = {
      framework: backendFramework,
      routes: uniqueSymbols(parsedData, 'route'),
      controllers: uniqueSymbols(parsedData, 'controller'),
      services: uniqueSymbols(parsedData, 'service').filter((n) =>
        relativeFiles.some((f) => /backend|server|api/i.test(f) && f.includes(n))
      ),
      middleware: collectByRole(relativeFiles, 'middleware'),
      apiLayers: relativeFiles
        .filter((f) => /\/api\//.test(normalizeRelativePath(f)))
        .slice(0, 8)
        .map((f) => normalizeRelativePath(f)),
      entryPoints: findEntryPoints(relativeFiles).filter(
        (ep) => /backend|server|api|index\.ts|main\./i.test(ep) && !ep.includes('pages/')
      ),
    };

    const orm =
      allDepNames.has('prisma') || allDepNames.has('@prisma/client')
        ? 'Prisma'
        : allDepNames.has('typeorm')
          ? 'TypeORM'
          : allDepNames.has('sequelize')
            ? 'Sequelize'
            : allDepNames.has('mongoose')
              ? 'Mongoose'
              : null;

    const database = {
      orm,
      drivers: dbLibs.filter((n) => /pg|mysql|mongo|redis|sqlite|prisma/i.test(n)),
      models: collectByRole(relativeFiles, 'model'),
      migrations: collectByRole(relativeFiles, 'migration'),
    };

    const externalServices: ArchitectureKnowledge['externalServices'] = [];
    if (allDepNames.has('openai') || allDepNames.has('@anthropic-ai/sdk')) {
      externalServices.push({
        name: 'LLM Provider',
        purpose: 'AI/LLM API integration',
        evidence: ['openai', '@anthropic-ai/sdk'].filter((n) => allDepNames.has(n)),
      });
    }
    if (allDepNames.has('chromadb')) {
      externalServices.push({
        name: 'Vector Store',
        purpose: 'Embedding storage and retrieval',
        evidence: ['chromadb'],
      });
    }
    if (allDepNames.has('axios') || allDepNames.has('node-fetch')) {
      externalServices.push({
        name: 'HTTP Clients',
        purpose: 'Outbound HTTP integrations',
        evidence: ['axios', 'node-fetch'].filter((n) => allDepNames.has(n)),
      });
    }

    const authFlows: string[] = [];
    if (relativeFiles.some((f) => /login|signin|auth/i.test(f))) authFlows.push('Login/sign-in handlers present');
    if (relativeFiles.some((f) => /middleware.*auth|auth.*middleware/i.test(f))) {
      authFlows.push('Auth middleware layer detected');
    }
    if (allDepNames.has('next-auth') || allDepNames.has('@auth0/nextjs-auth0')) {
      authFlows.push('Framework-managed session authentication');
    }

    const authentication = {
      strategy:
        authLibs.length > 0
          ? authLibs.includes('passport')
            ? 'Passport-based'
            : authLibs.includes('next-auth')
              ? 'NextAuth'
              : authLibs.includes('jsonwebtoken')
                ? 'JWT'
                : 'Library-based auth'
          : authFlows.length > 0
            ? 'Custom auth flow'
            : null,
      libraries: authLibs,
      flows: authFlows,
    };

    const dataFlow: string[] = [];
    if (frontend.framework && backend.framework) {
      dataFlow.push(`${frontend.framework} UI → ${backend.framework} API → persistence layer`);
    } else if (frontend.framework) {
      dataFlow.push(`${frontend.framework} renders UI and calls APIs via client services`);
    } else if (backend.framework) {
      dataFlow.push(`HTTP requests enter ${backend.framework} routes → controllers → services`);
    }
    if (database.orm) {
      dataFlow.push(`Services use ${database.orm} to read/write data`);
    }
    if (externalServices.length) {
      dataFlow.push(`Backend integrates with: ${externalServices.map((e) => e.name).join(', ')}`);
    }

    const topFolders = Array.from(getTopLevelFolders(relativeFiles).entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name}/ (${count} files)`);

    const partial = { frontend, backend, database, externalServices, authentication, dataFlow };
    const diagram = buildLogicalDiagram(partial);

    const summary = [
      frontend.framework ? `Frontend: ${frontend.framework}` : null,
      backend.framework ? `Backend: ${backend.framework}` : null,
      database.orm ? `Persistence: ${database.orm}` : null,
      `Top-level areas: ${topFolders.join(', ') || 'n/a'}`,
      authentication.strategy ? `Auth: ${authentication.strategy}` : null,
    ]
      .filter(Boolean)
      .join('. ');

    return {
      generatedAt: new Date().toISOString(),
      ...partial,
      diagram,
      summary,
    };
  }
}

export const architectureGeneratorService = new ArchitectureGeneratorService();
