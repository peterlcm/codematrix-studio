# CodeMatrix Studio

AI+Human Collaborative Software Development Platform built on VS Code.

## Overview

CodeMatrix Studio enforces a collaborative development workflow where **AI works first at each stage, then human reviews/edits/approves, then AI proceeds to the next stage**. This covers the full development lifecycle:

1. **Product Requirements Document (PRD) Design** - AI generates comprehensive PRD from your idea
2. **UI/UX Design** - AI designs interaction flows and component structure based on approved PRD
3. **Full-Stack Development** - AI generates frontend and backend code based on approved specs
4. **Testing** - AI generates test plans and test cases

All team members collaborate within VS Code with real-time sync.

## Architecture

- **VS Code Extension**: Built with TypeScript, provides the IDE integration
- **Webview UI**: React-based UI for the collaborative workspace
- **Backend Service**: Node.js + Express + PostgreSQL + Redis, handles workflow orchestration and real-time collaboration
- **AI Integration**: Anthropic Claude (default) with support for multiple providers

## Prerequisites

- Node.js 20+
- pnpm
- Docker and Docker Compose (for PostgreSQL and Redis)
- Anthropic API key

## Getting Started

### 1. Install dependencies

```bash
pnpm install:all
```

### 2. Start databases with Docker Compose

```bash
docker-compose up -d
```

### 3. Configure environment variables

Copy the `.env.example` to `.env` in the `backend` directory and fill in your Anthropic API key:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env to add ANTHROPIC_API_KEY
```

### 4. Run database migrations

```bash
cd backend
pnpm prisma migrate dev
```

### 5. Build the project

```bash
pnpm build
```

### 6. Start the backend service

```bash
cd backend
pnpm dev
```

### 7. Run the VS Code extension in development

Open this project in VS Code and press F5 to launch the extension development host.

## Workflow

1. **Create a new project** using the command `CodeMatrix: Initialize Project`
2. **Start workflow** - AI generates the PRD automatically
3. **Review and approve** - Edit the PRD, add comments, approve when ready
4. **AI proceeds to next stage** - automatically generates UI/UX design based on approved PRD
5. **Repeat review/approve** for each stage
6. **Final output** - you get a complete project with code and tests

## Project Structure

```
codematrix-studio/
├── extensions/          # VS Code extension
├── webview-ui/         # React webview UI
├── backend/            # Backend service
└── docker-compose.yml  # Local Docker compose for databases
```

## License

MIT
