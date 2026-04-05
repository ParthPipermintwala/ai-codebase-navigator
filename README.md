<p align="center">
	<img src="https://capsule-render.vercel.app/api?type=waving&height=250&text=AI%20Codebase%20Navigator&fontAlign=50&fontAlignY=36&color=0:0b132b,30:1c2541,65:0f4c5c,100:2ec4b6&fontColor=ffffff&desc=Oceanlab%20X%20CHARUSAT%20Hackathon%20Project&descAlign=50&descAlignY=58&animation=fadeIn" alt="banner"/>
</p>

<p align="center">
	<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=20&pause=950&color=2EC4B6&center=true&vCenter=true&width=980&lines=Understand+any+GitHub+repository+faster;AI+analysis+%7C+Repository+map+%7C+Bug+detection+%7C+Impact+simulation;Built+at+Oceanlab+X+CHARUSAT+Hackathon" alt="typing" />
</p>

<p align="center">
	<img src="https://img.shields.io/badge/Hackathon-Oceanlab%20X%20CHARUSAT-0ea5e9?style=for-the-badge" alt="hackathon" />
	<img src="https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20Vite-14b8a6?style=for-the-badge" alt="frontend" />
	<img src="https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-0f766e?style=for-the-badge" alt="backend" />
	<img src="https://img.shields.io/badge/Data-Supabase%20%7C%20Redis-0d9488?style=for-the-badge" alt="data" />
	<img src="https://img.shields.io/badge/AI-OpenRouter%20%7C%20Pinecone-06b6d4?style=for-the-badge" alt="ai" />
</p>

---

## Why This Project

AI Codebase Navigator turns any GitHub repository into an interactive developer cockpit.

Instead of manually reading file-by-file, it helps you:

- Understand architecture quickly
- Explore structure visually
- Detect dependencies and risk zones
- Ask codebase-specific questions with AI
- Simulate change impact before editing

> Built to solve: "How can developers safely understand and modify unfamiliar codebases faster?"

---

## Feature Highlights

| Feature | What it does |
|---|---|
| Analyze Repository | Ingests a GitHub URL and builds repository insights |
| Repository Map | Visualizes folder and module hierarchy |
| Dependency Explorer | Detects packages and versions quickly |
| AI Chat | Answers context-aware questions about analyzed code |
| Impact Analysis | Predicts blast radius for file/module/function changes |
| Bug Detector | Surfaces risky code paths and bug hotspots |
| Guided Codebase Tour | Walks through key modules for faster onboarding |

---

## Animated Flow

```mermaid
flowchart TD
	A[User enters GitHub repository URL]
	A --> B[Repository analysis pipeline]

	subgraph INGEST[Ingestion and Understanding]
		direction TB
		B --> C[Fetch metadata and repository tree]
		C --> D[Extract dependencies and structure]
		D --> E[Generate embeddings and index context]
	end

	subgraph INTEL[AI Intelligence Layer]
		direction TB
		E --> F[Context retrieval engine]
		F --> G[Repository-aware AI responses]
	end

	subgraph OUTPUT[Developer Outputs]
		direction LR
		G --> H[AI Chat]
		G --> I[Impact Analysis]
		G --> J[Bug Detector]
		G --> K[Repository Map]
		G --> L[Guided Tour]
	end

	classDef ingest fill:#0f172a,stroke:#2ec4b6,color:#e2e8f0,stroke-width:1px;
	classDef intel fill:#111827,stroke:#22d3ee,color:#e2e8f0,stroke-width:1px;
	classDef output fill:#0b132b,stroke:#14b8a6,color:#e2e8f0,stroke-width:1px;

	class B,C,D,E ingest;
	class F,G intel;
	class H,I,J,K,L output;
```

---

## Tech Stack

<p align="center">
	<img src="https://skillicons.dev/icons?i=react,ts,vite,tailwind,nodejs,express,postgres,redis,github" alt="stack-icons" />
</p>

<p align="center">
	<img src="https://img.shields.io/badge/Core-Modern%20TypeScript%20Fullstack-0f172a?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="core" />
	<img src="https://img.shields.io/badge/AI-RAG%20%2B%20Vector%20Search-111827?style=for-the-badge&logo=openai&logoColor=22d3ee" alt="ai-core" />
	<img src="https://img.shields.io/badge/Infra-Cloud%20Native%20Deployment-0b132b?style=for-the-badge&logo=vercel&logoColor=ffffff" alt="infra" />
</p>

<table>
	<tr>
		<th align="left" width="22%">Domain</th>
		<th align="left">Stack</th>
		<th align="left" width="22%">Purpose</th>
	</tr>
	<tr>
		<td><strong>Frontend UI</strong></td>
		<td>
			<img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
			<img src="https://img.shields.io/badge/TypeScript-1f2937?style=flat-square&logo=typescript&logoColor=3178C6" alt="TypeScript" />
			<img src="https://img.shields.io/badge/Vite-111827?style=flat-square&logo=vite&logoColor=646CFF" alt="Vite" />
			<img src="https://img.shields.io/badge/Tailwind_CSS-0f172a?style=flat-square&logo=tailwindcss&logoColor=38B2AC" alt="Tailwind CSS" />
			<img src="https://img.shields.io/badge/shadcn%2Fui-111827?style=flat-square&logo=radix-ui&logoColor=ffffff" alt="shadcn ui" />
			<img src="https://img.shields.io/badge/Framer_Motion-0f172a?style=flat-square&logo=framer&logoColor=ffffff" alt="Framer Motion" />
		</td>
		<td>Interactive, responsive, animated UX</td>
	</tr>
	<tr>
		<td><strong>Backend API</strong></td>
		<td>
			<img src="https://img.shields.io/badge/Node.js-0f172a?style=flat-square&logo=nodedotjs&logoColor=339933" alt="Node.js" />
			<img src="https://img.shields.io/badge/Express-111827?style=flat-square&logo=express&logoColor=ffffff" alt="Express" />
			<img src="https://img.shields.io/badge/JWT-0b132b?style=flat-square&logo=jsonwebtokens&logoColor=ffffff" alt="JWT" />
			<img src="https://img.shields.io/badge/Cookie--Session-0f172a?style=flat-square&logo=databricks&logoColor=ffffff" alt="cookie" />
		</td>
		<td>Auth, analysis, routing, and API orchestration</td>
	</tr>
	<tr>
		<td><strong>Data Layer</strong></td>
		<td>
			<img src="https://img.shields.io/badge/Supabase-0f172a?style=flat-square&logo=supabase&logoColor=3ECF8E" alt="Supabase" />
			<img src="https://img.shields.io/badge/PostgreSQL-111827?style=flat-square&logo=postgresql&logoColor=4169E1" alt="PostgreSQL" />
			<img src="https://img.shields.io/badge/Redis-111827?style=flat-square&logo=redis&logoColor=DC382D" alt="Redis" />
		</td>
		<td>Persistence, caching, and fast retrieval</td>
	</tr>
	<tr>
		<td><strong>AI + Search</strong></td>
		<td>
			<img src="https://img.shields.io/badge/OpenRouter-0f172a?style=flat-square&logo=openai&logoColor=10b981" alt="OpenRouter" />
			<img src="https://img.shields.io/badge/Pinecone-111827?style=flat-square&logo=pinecone&logoColor=22d3ee" alt="Pinecone" />
			<img src="https://img.shields.io/badge/GitHub_API-0f172a?style=flat-square&logo=github&logoColor=ffffff" alt="GitHub API" />
		</td>
		<td>Context indexing, semantic retrieval, code-aware AI</td>
	</tr>
	<tr>
		<td><strong>Payments + Deploy</strong></td>
		<td>
			<img src="https://img.shields.io/badge/Stripe-0f172a?style=flat-square&logo=stripe&logoColor=635BFF" alt="Stripe" />
			<img src="https://img.shields.io/badge/Vercel-111827?style=flat-square&logo=vercel&logoColor=ffffff" alt="Vercel" />
			<img src="https://img.shields.io/badge/Render-0f172a?style=flat-square&logo=render&logoColor=46E3B7" alt="Render" />
		</td>
		<td>Subscription checkout and production hosting</td>
	</tr>
</table>

---

## Project Structure

```text
ai-code-nav/
|- backend/   # APIs, auth, repository analysis, AI services
|- client/    # UI pages, components, interactions
|- README.md
```

---

## Quick Start

### 1. Clone

```bash
git clone <YOUR_REPO_URL>
cd "ai code nav"
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

---

## Environment Variables

### Backend (.env)
- Database/cache: Supabase, Redis
- Auth/session: JWT secret, cookie secret
- OAuth: GitHub, Google
- AI providers: OpenRouter, embeddings
- Payment (optional): Stripe

### Frontend (.env)
- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`

---

## Demo Sequence

1. Login with GitHub or Google
2. Analyze a repository URL
3. Show Repository Map
4. Ask AI Chat a repo-specific question
5. Run Impact Analysis on a target module
6. Show Bug Detector + dependencies + guided tour

---

## Created By

<table>
	<tr>
		<td align="center" width="50%">
			<a href="https://github.com/ParthPipermintwala">
				<img src="https://github.com/ParthPipermintwala.png?size=160" width="110" height="110" alt="ParthPipermintwala avatar" />
			</a>
			<br />
			<strong>ParthPipermintwala Pipermintwala</strong>
			<br />
			<sub>Full-Stack + Product Engineering</sub>
			<br /><br />
			<a href="https://github.com/ParthPipermintwala">
				<img src="https://img.shields.io/badge/GitHub-@ParthPipermintwala-111827?style=flat-square&logo=github&logoColor=ffffff" alt="Parth GitHub" />
			</a>
		</td>
		<td align="center" width="50%">
			<a href="https://github.com/DarshanModi07">
				<img src="https://github.com/DarshanModi07.png?size=160" width="110" height="110" alt="DarshanModi07 avatar" />
			</a>
			<br />
			<strong>Darshan Modi</strong>
			<br />
			<sub>AI Logic + Developer Experience</sub>
			<br /><br />
			<a href="https://github.com/DarshanModi07">
				<img src="https://img.shields.io/badge/GitHub-@DarshanModi07-111827?style=flat-square&logo=github&logoColor=ffffff" alt="Darshan GitHub" />
			</a>
		</td>
	</tr>
</table>

<p align="center">
	Made with code, coffee, and hackathon pressure.
</p>

<p align="center">
	<img src="https://img.shields.io/badge/Built%20At-Oceanlab%20X%20CHARUSAT-0ea5e9?style=for-the-badge" alt="built-at" />
	<img src="https://img.shields.io/badge/Project-AI%20Codebase%20Navigator-14b8a6?style=for-the-badge" alt="project" />
</p>

<p align="center">
	<img src="https://capsule-render.vercel.app/api?type=waving&section=footer&height=120&color=0:0b132b,30:1c2541,65:0f4c5c,100:2ec4b6" alt="footer"/>
</p>


