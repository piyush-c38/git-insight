import { RepositoryKnowledge } from '../../types/knowledge';
import { ParsedFileRecord, toRelativePath } from '../../lib/repo-structure';
import { architectureGeneratorService } from './architecture-generator.service';
import { dependencyAnalyzerService } from './dependency-analyzer.service';
import { onboardingService } from './onboarding.service';
import { repositorySummaryService } from './repository-summary.service';
import { techStackService } from './tech-stack.service';

export type KnowledgeGenerationInput = {
  repoRoot: string;
  relativeFiles: string[];
  parsedData: ParsedFileRecord[];
  packageJson?: Record<string, unknown>;
  repoLanguages?: string[];
};

class KnowledgeGeneratorService {
  generateAll(input: KnowledgeGenerationInput): RepositoryKnowledge {
    const parsedRelative: ParsedFileRecord[] = input.parsedData.map((row) => ({
      ...row,
      filePath: row.filePath.includes(input.repoRoot)
        ? toRelativePath(input.repoRoot, row.filePath)
        : row.filePath,
    }));

    const dependencySummary = dependencyAnalyzerService.analyze(input.repoRoot, input.relativeFiles);
    const techStack = techStackService.analyze(
      input.relativeFiles,
      dependencySummary,
      input.repoLanguages ?? []
    );
    const architecture = architectureGeneratorService.generate(
      input.relativeFiles,
      parsedRelative,
      dependencySummary
    );
    const onboarding = onboardingService.analyze(
      input.repoRoot,
      input.relativeFiles,
      input.packageJson
    );
    const repositorySummary = repositorySummaryService.generate(
      input.repoRoot,
      input.relativeFiles,
      architecture,
      input.packageJson
    );

    return {
      architecture,
      dependencySummary,
      techStack,
      onboarding,
      repositorySummary,
    };
  }
}

export const knowledgeGeneratorService = new KnowledgeGeneratorService();
