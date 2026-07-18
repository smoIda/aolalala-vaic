# aolalala

Multi-service Hert Hospital demo workspace with a chatbot backend, a Next.js frontend, and a standalone ticket dashboard.

## Project Layout

- `backend/` - Node.js/TypeScript chatbot platform using Fastify, Postgres, MCP retrieval, OpenRouter integration, and import scripts.
- `frontend/` - Next.js application built with React, TypeScript, Tailwind CSS, ESLint, and Prettier.
- `Dashboard/` - FastAPI ticket dashboard with a vanilla HTML/CSS/JS frontend.
- `Makefile` - root Docker workflow for starting, stopping, logging, and health-checking services.
- `AGENTS.md` - contributor and agent guidance for this repository.

## Requirements

- Node.js and npm
- Docker with Docker Compose
- Python 3.10+ for local dashboard development

## Quick Start

Start the backend and dashboard Docker stacks:

```bash
make up
```

Check service health:

```bash
make health
```

Stop all services:

```bash
make down
```

## Service URLs

- Chatbot API: `http://localhost:3000`
- Hert Hospital MCP: `http://localhost:15000`
- Adminer: `http://localhost:18080`
- Dashboard: `http://localhost:8000`

## Backend

Run commands from `backend/`:

```bash
npm install
cp .env.example .env
npm run dev:chatbot
npm run dev:mcp
npm run import:data
npm run typecheck
```

The backend imports hospital knowledge from `backend/data-tim.xlsx` and uses `.env` for database, OpenRouter, MCP, and internal API configuration.

## Frontend

Run commands from `frontend/`:

```bash
npm install
npm run dev
npm run build
npm run lint
```

The app source is under `frontend/src`. Check `frontend/AGENTS.md` before making frontend changes because this project uses a newer Next.js version with different conventions.

## Dashboard

Run the dashboard with Docker:

```bash
cd Dashboard
make up
make health
```

Or run the FastAPI app locally:

```bash
cd Dashboard/backend
pip install -r requirements.txt
python run.py
```

The dashboard API serves the browser UI at `http://127.0.0.1:8000/` and Swagger docs at `http://127.0.0.1:8000/docs`.

## Verification

There is no dedicated test suite in the current workspace. Use the closest checks for the area changed:

- `backend/`: `npm run typecheck`
- `frontend/`: `npm run lint` and `npm run build`
- root Docker stack: `make health`

## Configuration Notes

Do not commit real secrets. Use `backend/.env.example` as the backend template. Keep generated artifacts such as `node_modules/`, `.next/`, logs, Python cache files, and local databases out of commits.
