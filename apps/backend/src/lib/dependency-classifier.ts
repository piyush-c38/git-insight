import { ClassifiedDependency, DependencyCategory } from '../types/knowledge';

type PackageRule = {
  category: DependencyCategory;
  explanation: string;
};

const EXACT: Record<string, PackageRule> = {
  react: { category: 'Frontend', explanation: 'UI library for building component-based interfaces.' },
  'react-dom': { category: 'Frontend', explanation: 'React renderer for the DOM.' },
  next: { category: 'Frontend', explanation: 'React framework with routing, SSR, and API routes.' },
  vue: { category: 'Frontend', explanation: 'Progressive JavaScript framework for UIs.' },
  angular: { category: 'Frontend', explanation: 'Full-featured frontend application framework.' },
  svelte: { category: 'Frontend', explanation: 'Compile-time UI framework.' },
  '@angular/core': { category: 'Frontend', explanation: 'Angular core runtime.' },
  express: { category: 'Backend', explanation: 'Minimal Node.js HTTP server framework.' },
  fastify: { category: 'Backend', explanation: 'High-performance Node.js web framework.' },
  koa: { category: 'Backend', explanation: 'Lightweight Node.js middleware framework.' },
  nestjs: { category: 'Backend', explanation: 'Structured Node.js server framework (Nest).' },
  '@nestjs/core': { category: 'Backend', explanation: 'NestJS application core.' },
  django: { category: 'Backend', explanation: 'Python full-stack web framework.' },
  flask: { category: 'Backend', explanation: 'Lightweight Python web microframework.' },
  fastapi: { category: 'Backend', explanation: 'Modern async Python API framework.' },
  spring: { category: 'Backend', explanation: 'Java enterprise application framework.' },
  gin: { category: 'Backend', explanation: 'Go HTTP web framework.' },
  prisma: { category: 'Database', explanation: 'Type-safe ORM and schema toolkit.' },
  '@prisma/client': { category: 'Database', explanation: 'Generated Prisma database client.' },
  typeorm: { category: 'Database', explanation: 'TypeScript ORM for SQL databases.' },
  sequelize: { category: 'Database', explanation: 'SQL ORM for Node.js.' },
  mongoose: { category: 'Database', explanation: 'MongoDB object modeling for Node.js.' },
  pg: { category: 'Database', explanation: 'PostgreSQL client for Node.js.' },
  mysql2: { category: 'Database', explanation: 'MySQL driver for Node.js.' },
  redis: { category: 'Database', explanation: 'In-memory data store, often used for caching.' },
  ioredis: { category: 'Database', explanation: 'Redis client for Node.js.' },
  passport: { category: 'Authentication', explanation: 'Authentication middleware for Node.js.' },
  'passport-jwt': { category: 'Authentication', explanation: 'JWT strategy for Passport.' },
  jsonwebtoken: { category: 'Authentication', explanation: 'JSON Web Token creation and verification.' },
  bcrypt: { category: 'Authentication', explanation: 'Password hashing library.' },
  'bcryptjs': { category: 'Authentication', explanation: 'Pure JS password hashing.' },
  '@auth0/nextjs-auth0': { category: 'Authentication', explanation: 'Auth0 integration for Next.js.' },
  'next-auth': { category: 'Authentication', explanation: 'Authentication for Next.js applications.' },
  redux: { category: 'State Management', explanation: 'Predictable state container for JavaScript apps.' },
  '@reduxjs/toolkit': { category: 'State Management', explanation: 'Official Redux tooling with less boilerplate.' },
  zustand: { category: 'State Management', explanation: 'Lightweight React state management.' },
  mobx: { category: 'State Management', explanation: 'Reactive state management library.' },
  recoil: { category: 'State Management', explanation: 'React state management by Facebook.' },
  jotai: { category: 'State Management', explanation: 'Primitive and flexible React state.' },
  jest: { category: 'Testing', explanation: 'JavaScript testing framework.' },
  vitest: { category: 'Testing', explanation: 'Vite-native unit test runner.' },
  mocha: { category: 'Testing', explanation: 'Flexible JavaScript test framework.' },
  cypress: { category: 'Testing', explanation: 'End-to-end browser testing.' },
  playwright: { category: 'Testing', explanation: 'Cross-browser automation and testing.' },
  '@testing-library/react': { category: 'Testing', explanation: 'React component testing utilities.' },
  webpack: { category: 'Build Tools', explanation: 'Module bundler for web applications.' },
  vite: { category: 'Build Tools', explanation: 'Fast frontend build tool and dev server.' },
  turbo: { category: 'Build Tools', explanation: 'Monorepo build system.' },
  esbuild: { category: 'Build Tools', explanation: 'Extremely fast JavaScript bundler.' },
  typescript: { category: 'Build Tools', explanation: 'Typed superset of JavaScript.' },
  eslint: { category: 'Build Tools', explanation: 'Pluggable JavaScript linter.' },
  prettier: { category: 'Build Tools', explanation: 'Opinionated code formatter.' },
  '@sentry/node': { category: 'Monitoring', explanation: 'Error and performance monitoring for Node.' },
  '@sentry/react': { category: 'Monitoring', explanation: 'Error monitoring for React apps.' },
  winston: { category: 'Monitoring', explanation: 'Logging library for Node.js.' },
  pino: { category: 'Monitoring', explanation: 'Low-overhead Node.js logger.' },
  axios: { category: 'Networking', explanation: 'Promise-based HTTP client.' },
  'node-fetch': { category: 'Networking', explanation: 'Fetch API for Node.js.' },
  got: { category: 'Networking', explanation: 'Human-friendly HTTP request library.' },
  'socket.io': { category: 'Networking', explanation: 'Real-time bidirectional event-based communication.' },
  openai: { category: 'AI/ML', explanation: 'OpenAI API client for LLM integrations.' },
  '@anthropic-ai/sdk': { category: 'AI/ML', explanation: 'Anthropic Claude API client.' },
  langchain: { category: 'AI/ML', explanation: 'Framework for LLM application development.' },
  '@langchain/core': { category: 'AI/ML', explanation: 'LangChain core abstractions.' },
  chromadb: { category: 'AI/ML', explanation: 'Embedding database for RAG pipelines.' },
  '@xenova/transformers': { category: 'AI/ML', explanation: 'On-device transformer models in JavaScript.' },
  'groq-sdk': { category: 'AI/ML', explanation: 'Groq LLM API client.' },
};

const PREFIX_RULES: { prefix: string; rule: PackageRule }[] = [
  { prefix: '@mui/', rule: { category: 'Frontend', explanation: 'Material UI component library.' } },
  { prefix: '@chakra-ui/', rule: { category: 'Frontend', explanation: 'Chakra UI component system.' } },
  { prefix: '@radix-ui/', rule: { category: 'Frontend', explanation: 'Accessible unstyled UI primitives.' } },
  { prefix: '@tailwindcss/', rule: { category: 'Frontend', explanation: 'Tailwind CSS tooling.' } },
  { prefix: '@nestjs/', rule: { category: 'Backend', explanation: 'NestJS framework module.' } },
  { prefix: '@apollo/', rule: { category: 'Backend', explanation: 'GraphQL tooling.' } },
  { prefix: '@prisma/', rule: { category: 'Database', explanation: 'Prisma ecosystem package.' } },
  { prefix: '@sentry/', rule: { category: 'Monitoring', explanation: 'Sentry monitoring SDK.' } },
  { prefix: '@testing-library/', rule: { category: 'Testing', explanation: 'Testing Library utilities.' } },
];

function emptyCategories(): Record<DependencyCategory, ClassifiedDependency[]> {
  return {
    Frontend: [],
    UI: [],
    Backend: [],
    Database: [],
    Authentication: [],
    'State Management': [],
    Testing: [],
    'Build Tools': [],
    Monitoring: [],
    Networking: [],
    'AI/ML': [],
    Utilities: [],
    Other: [],
  };
}

export function classifyPackage(name: string, version: string, source: string): ClassifiedDependency {
  const exact = EXACT[name];
  if (exact) {
    return { name, version, category: exact.category, explanation: exact.explanation, source };
  }

  for (const { prefix, rule } of PREFIX_RULES) {
    if (name.startsWith(prefix)) {
      return { name, version, category: rule.category, explanation: rule.explanation, source };
    }
  }

  const lower = name.toLowerCase();
  if (/react|vue|svelte|angular|tailwind|styled|emotion|radix|shadcn/.test(lower)) {
    return { name, version, category: 'Frontend', explanation: 'Frontend/UI package inferred from name.', source };
  }
  if (/express|fastify|koa|nest|django|flask|spring|gin|hapi/.test(lower)) {
    return { name, version, category: 'Backend', explanation: 'Backend framework or server package.', source };
  }
  if (/prisma|sequelize|typeorm|mongoose|postgres|mysql|mongo|redis|drizzle|knex/.test(lower)) {
    return { name, version, category: 'Database', explanation: 'Database or persistence-related package.', source };
  }
  if (/auth|jwt|oauth|passport|bcrypt|session|clerk/.test(lower)) {
    return { name, version, category: 'Authentication', explanation: 'Authentication-related package.', source };
  }
  if (/redux|zustand|mobx|recoil|jotai|xstate/.test(lower)) {
    return { name, version, category: 'State Management', explanation: 'State management package.', source };
  }
  if (/jest|vitest|mocha|cypress|playwright|testing|chai|sinon/.test(lower)) {
    return { name, version, category: 'Testing', explanation: 'Testing or QA package.', source };
  }
  if (/webpack|vite|rollup|esbuild|babel|eslint|prettier|turbo|tsc/.test(lower)) {
    return { name, version, category: 'Build Tools', explanation: 'Build, compile, or lint tooling.', source };
  }
  if (/sentry|datadog|newrelic|prometheus|winston|pino|log/.test(lower)) {
    return { name, version, category: 'Monitoring', explanation: 'Observability or logging package.', source };
  }
  if (/axios|fetch|http|socket|grpc|graphql|trpc/.test(lower)) {
    return { name, version, category: 'Networking', explanation: 'HTTP or network communication package.', source };
  }
  if (/openai|anthropic|langchain|llama|transformers|tensorflow|torch|onnx|chromadb|embedding/.test(lower)) {
    return { name, version, category: 'AI/ML', explanation: 'AI, ML, or LLM-related package.', source };
  }

  return {
    name,
    version,
    category: 'Utilities',
    explanation: 'General-purpose utility dependency.',
    source,
  };
}

export function groupByCategory(deps: ClassifiedDependency[]): Record<DependencyCategory, ClassifiedDependency[]> {
  const grouped = emptyCategories();
  for (const dep of deps) {
    grouped[dep.category].push(dep);
  }
  return grouped;
}
