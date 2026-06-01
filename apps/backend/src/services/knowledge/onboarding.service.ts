import fs from 'fs';
import path from 'path';
import { OnboardingKnowledge } from '../../types/knowledge';
import { findEntryPoints, getTopLevelFolders, normalizeRelativePath } from '../../lib/repo-structure';

function readReadme(repoRoot: string): string | undefined {
  const candidates = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
  for (const name of candidates) {
    const filePath = path.join(repoRoot, name);
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function extractSetupSteps(readme: string | undefined): string[] {
  if (!readme) return [];
  const lines = readme.split('\n');
  const steps: string[] = [];
  let inSetup = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#+\s*(getting started|setup|installation|quick start|development)/i.test(trimmed)) {
      inSetup = true;
      continue;
    }
    if (inSetup && /^#+\s/.test(trimmed) && !/setup|install|start/i.test(trimmed)) {
      break;
    }
    if (inSetup && /^[-*]\s+|^\d+\.\s+/.test(trimmed)) {
      steps.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
    }
    if (inSetup && trimmed.startsWith('```') && steps.length > 0) {
      break;
    }
  }

  return steps.slice(0, 10);
}

function findEnvExamples(relativeFiles: string[]): string[] {
  return relativeFiles
    .filter((f) => /\.env(\.example|\.sample|\.local\.example)?$/i.test(normalizeRelativePath(f)))
    .slice(0, 6);
}

class OnboardingService {
  analyze(
    repoRoot: string,
    relativeFiles: string[],
    packageJson?: Record<string, unknown>
  ): OnboardingKnowledge {
    const readme = readReadme(repoRoot);
    const setupSteps = extractSetupSteps(readme);

    const prerequisites: string[] = [];
    if (relativeFiles.some((f) => /\.tsx?$/.test(f))) prerequisites.push('Node.js (LTS recommended)');
    if (relativeFiles.some((f) => f.endsWith('.py'))) prerequisites.push('Python 3');
    if (relativeFiles.some((f) => f.endsWith('go.mod') || normalizeRelativePath(f) === 'go.mod')) {
      prerequisites.push('Go toolchain');
    }
    if (relativeFiles.some((f) => f.endsWith('docker-compose.yml') || f.endsWith('Dockerfile'))) {
      prerequisites.push('Docker (optional)');
    }

    const scripts: OnboardingKnowledge['scripts'] = [];
    if (packageJson?.scripts && typeof packageJson.scripts === 'object') {
      const scriptMap = packageJson.scripts as Record<string, string>;
      const purposes: Record<string, string> = {
        dev: 'Start local development server',
        start: 'Start production server',
        build: 'Build for production',
        test: 'Run test suite',
        lint: 'Run linter',
      };
      for (const [name, command] of Object.entries(scriptMap).slice(0, 12)) {
        scripts.push({
          name,
          command,
          purpose: purposes[name] ?? 'Project script',
        });
      }
    }

    const envFiles = findEnvExamples(relativeFiles);
    const environmentVariables = envFiles.map((f) => `See ${f} for required variables`);

    const topFolders = Array.from(getTopLevelFolders(relativeFiles).keys())
      .slice(0, 10)
      .map((name) => `${name}/ — primary code area`);

    const entryPoints = findEntryPoints(relativeFiles);
    const commonTasks: string[] = [];
    if (scripts.some((s) => s.name === 'dev')) commonTasks.push('Run `npm run dev` (or workspace equivalent) for local development');
    if (scripts.some((s) => s.name === 'test')) commonTasks.push('Run `npm test` before submitting changes');
    if (entryPoints.length) {
      commonTasks.push(`Start exploring from entry points: ${entryPoints.slice(0, 3).join(', ')}`);
    }
    if (relativeFiles.some((f) => /\/api\//.test(f))) {
      commonTasks.push('API routes live under paths containing `/api/`');
    }

    const defaultSetup =
      setupSteps.length === 0
        ? [
            'Clone the repository',
            'Install dependencies from manifest files (package.json, requirements.txt, etc.)',
            'Copy environment example files if present',
            'Run the development script',
          ]
        : setupSteps;

    return {
      generatedAt: new Date().toISOString(),
      prerequisites: [...new Set(prerequisites)],
      setupSteps: defaultSetup,
      environmentVariables,
      scripts,
      projectStructure: topFolders,
      commonTasks,
      summary: `Onboarding guide derived from README, scripts, and repository layout. ${scripts.length} npm scripts, ${topFolders.length} top-level areas.`,
    };
  }
}

export const onboardingService = new OnboardingService();
