# AI GitHub Explainer

AI GitHub Explainer is a tool that analyzes a GitHub repository and explains how it works in a simple way. It shows the file structure, important dependencies, and key parts of the codebase. You can also ask questions about the repo using AI.

## Project Title and Description

**Project name:** AI GitHub Explainer

This project helps you understand a code repository without reading every file by hand. It scans the repo, highlights the important parts, and gives you a clear dashboard to explore it.

## Tech Stacks Used

- Next.js
- React
- TypeScript
- Tailwind CSS
- Express
- Turborepo
- React Flow
- Mermaid
- Groq AI
- ChromaDB

## How to Setup

1. Clone the repository.

```bash
git clone https://github.com/YOUR_GITHUB/ai-github-explainer.git
cd ai-github-explainer
```

2. Install the dependencies.

```bash
npm install
```

3. Add the required environment variables for the backend.

```bash
# apps/backend/src/.env
GROQ_API_KEY=your_groq_api_key
GITHUB_TOKEN=your_github_token
```

4. Start the app.

```bash
npm run dev
```

The frontend runs on `http://localhost:3000` and the backend runs on `http://localhost:3001`.

## Folder Structure

- `apps/frontend` - The web app that shows the dashboard and UI.
- `apps/backend` - The API server that analyzes repositories.
- `packages` - Shared code, types, and config.

## Features

- Analyze a GitHub repository from a URL.
- Show the repository file explorer.
- Show dependency graphs and other visual views.
- Display file contents in a readable code view.
- Show repository stats like stars, forks, and tech stack.
- Ask AI questions about the repository.
- Show a simple onboarding view with the entry file and other important files.