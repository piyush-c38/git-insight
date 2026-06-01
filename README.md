# GitInsight

An AI GitHub Explainer tool that analyzes a GitHub repository and explains how it works in a simple way. It shows the file structure, important dependencies, architecture, and key parts of the codebase. You can also ask questions about the repository using AI.

Demo Link: https://git-insight-one.vercel.app/ 

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* React Flow
* Mermaid

### Backend

* Node.js
* Express
* TypeScript

### AI & Analysis

* Groq API
* Tree-sitter
* Babel / TypeScript Compiler API
* Local Vector Store
* Transformer-based Embeddings

### Monorepo Structure

* Turborepo
* npm Workspaces

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/piyush-c38/git-insight.git 
cd git-insight
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Backend:

```env
GROQ_API_KEY=your_groq_api_key
GITHUB_TOKEN=your_github_token
GROQ_MODEL=your_groq_model_name
PORT=suitable_port
FRONTEND_URL=frontend_url
TAVILY_API_KEY=your_tavily_api_key
```

### 4. Run Development Server

```bash
npm run dev
```


## Folder Structure

This project uses a Turborepo monorepo structure.

- `apps/frontend` - Next.js frontend application.
- `apps/backend` - Express backend API.
- `packages` - Shared packages, utilities, and types.

## Features

* Analyze a GitHub repository from a URL.
* Repository architecture analysis.
* Dependency detection and dependency graphs.
* File explorer with source code viewer.
* AI-powered repository chat.
* Repository summary.

## Considerations I made while Production Deployment

### Frontend

Hosted on Vercel.

### Backend

Hosted on Railway.

### Storage

Local persistent vector store using Railway volume storage.

### Vector Storage

The project uses a local persistent vector store.

Reason:

* Simpler deployment.
* No external vector database required.

## Known Constraints of my project

* Embedding generation runs on CPU.
* Analysis time depends on repository size.
* Large repositories may take longer to process.
* Public repositories are fully supported.

## Disclaimer

> GitInsight is an MVP project under active development and is currently maintained solely by the repository owner.
> Some features may be incomplete, experimental, or subject to change.

> Feedback, bug reports, suggestions, and contributions are always appreciated.