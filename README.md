# AI Codebase Navigator

> Understand any GitHub repository in minutes, not hours.

AI Codebase Navigator is an AI-assisted platform that turns a repository into a clear, interactive workspace: architecture summaries, dependency analysis, repository maps, impact insights, and a guided codebase tour.

## What it helps with

- Faster onboarding into unfamiliar codebases
- Clearer understanding of folder structure and responsibilities
- Dependency and architecture visibility
- Safer change planning with impact analysis
- Natural-language exploration through AI chat

## Product Highlights

- **AI Codebase Analysis** - Generate a high-level view of the project instantly.
- **Repository Map** - Visualize the folder and file hierarchy.
- **AI Chat Assistant** - Ask questions about any analyzed repository.
- **Dependency Insights** - Review packages and versions in a clean grouped view.
- **Impact Analysis** - See what could break before you change a file.
- **Guided Tour** - Walk through key areas of the codebase step by step.

## Quick Start

1. Open the app and paste a public GitHub repository URL.
2. Run analysis to generate insights.
3. Explore the repository map, chat assistant, dependency list, and guided tour.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, Supabase, Redis
- AI + analysis: repository metadata, structured summaries, and interactive exploration

## Development

```bash
cd client
npm install
npm run dev
```

```bash
cd backend
npm install
npm run dev
```

## Notes

- Configure environment variables before starting the backend and frontend.
- For Google login, set `VITE_GOOGLE_CLIENT_ID` in the client environment.
- For OAuth callbacks, keep backend redirect settings aligned with your provider console.


