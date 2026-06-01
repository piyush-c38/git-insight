import { ChatIntent } from '../../types/knowledge';

const INTENT_PATTERNS: { intent: ChatIntent; patterns: RegExp[] }[] = [
  {
    intent: 'architecture',
    patterns: [
      /\b(architecture|architectural|system design|how is (the |this )?project structured|project structure|high[- ]level design|component diagram|layers? of (the )?app)\b/i,
      /\bexplain (the )?(system|software) (design|structure)\b/i,
      /\b(frontend|backend|database) layer\b/i,
      /\bdata flow\b/i,
    ],
  },
  {
    intent: 'dependency',
    patterns: [
      /\b(dependencies|dependency|npm packages?|libraries used|why is .+ used|what packages)\b/i,
      /\b(dev|peer|prod) dependencies\b/i,
      /\bpackage\.json\b/i,
    ],
  },
  {
    intent: 'tech_stack',
    patterns: [
      /\b(tech stack|technology stack|technologies used|what (framework|language|stack)|built with)\b/i,
      /\b(what is this (repo|project) (written|built) in)\b/i,
    ],
  },
  {
    intent: 'onboarding',
    patterns: [
      /\b(onboard|getting started|how (to|do i) (run|start|setup|install)|setup (guide|instructions)|development environment|contributor guide)\b/i,
      /\b(prerequisites|env(ironment)? variables?|npm run)\b/i,
      /\bhow can i (contribute|work on)\b/i,
    ],
  },
  {
    intent: 'repository_summary',
    patterns: [
      /\b(summarize (the )?repo|repository summary|what does this (repo|project) do|purpose of (the )?repo|overview of (the )?project)\b/i,
      /\b(main modules|core features|key workflows|entry points)\b/i,
    ],
  },
];

const CODE_PATTERNS: RegExp[] = [
  /\b(where is|find|locate|implemented|implementation of)\b/i,
  /\b(explain|show|walk through|how does).+\b(function|class|method|controller|component|hook|module|file|flow|endpoint)\b/i,
  /\b(AuthController|login flow|signup|handler for)\b/i,
  /\.(ts|tsx|js|jsx|py)\b/i,
  /\b(this function|this class|this file|specific code)\b/i,
];

class ChatRouterService {
  classifyIntent(query: string): ChatIntent {
    const normalized = query.trim();

    for (const { intent, patterns } of INTENT_PATTERNS) {
      if (patterns.some((pattern) => pattern.test(normalized))) {
        if (intent !== 'repository_summary' && CODE_PATTERNS.some((p) => p.test(normalized))) {
          const hasSpecificSymbol = /\b[A-Z][a-zA-Z0-9]+(?:Controller|Service|Component|Hook)\b/.test(normalized);
          const hasFileRef = /\.(ts|tsx|js|jsx|py)\b/.test(normalized) || /\b(where is|find)\b/i.test(normalized);
          if (hasSpecificSymbol || hasFileRef) {
            return 'code';
          }
        }
        return intent;
      }
    }

    if (CODE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return 'code';
    }

    return 'code';
  }
}

export const chatRouterService = new ChatRouterService();
