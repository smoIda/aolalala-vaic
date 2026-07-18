# Repository Guidelines

## Project Structure & Module Organization

This is a multi-service workspace. `backend/` contains the Node.js/TypeScript Hert Hospital chatbot platform, with services in `backend/apps/*`, shared MCP code in `backend/packages/*`, SQL in `backend/sql/`, and import scripts in `backend/scripts/`. `frontend/` is the Next.js app; source lives in `frontend/src/app`, `frontend/src/components`, `frontend/src/hooks`, and `frontend/src/lib`, with static assets in `frontend/public`. `Dashboard/` is a separate FastAPI plus vanilla HTML/CSS/JS ticket dashboard: Python code is in `Dashboard/backend/app`, and browser files are in `Dashboard/frontend`.

## Build, Test, and Development Commands

Use the root `Makefile` for Docker workflows:

- `make up` starts the backend stack and dashboard.
- `make down` stops both stacks.
- `make health` checks `chatbot-api`, `backoffice-api`, MCP, and dashboard health endpoints.
- `make backend-logs` / `make dashboard-logs` follow service logs.

Backend commands run from `backend/`: `npm install`, `npm run dev:chatbot`, `npm run dev:mcp`, `npm run import:data`, and `npm run typecheck`. Frontend commands run from `frontend/`: `npm run dev`, `npm run build`, `npm run start`, and `npm run lint`. Dashboard commands run from `Dashboard/`: `make up`, `make health`, or `cd backend && python run.py`.

## Coding Style & Naming Conventions

TypeScript uses ESM imports, Zod validation where applicable, and 2-space indentation. React components should use PascalCase filenames/exports; hooks and utilities use camelCase. The frontend uses ESLint with Next core-vitals/typescript config and Prettier with `prettier-plugin-tailwindcss`. Python dashboard modules use snake_case files, Pydantic models, and router/service/repository separation.

## Testing Guidelines

No dedicated test suite is currently present. For existing changes, run the closest verification: `npm run typecheck` in `backend/`, `npm run lint` and `npm run build` in `frontend/`, and `make health` after Docker startup. When adding tests, place them beside the code they cover and use clear `*.test.ts` or `test_*.py` naming.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries such as `Update .env sample` and `Upload Dashboard (version 1.0)`. Keep commits focused and descriptive; mention the touched service when useful, for example `backend: validate chat sessions`. Pull requests should include a short problem/solution summary, verification commands run, linked issues or tickets, and screenshots or screen recordings for UI changes.

## Security & Configuration Tips

Never commit real secrets. Use `backend/.env.example` as the template for local backend settings, and keep generated logs, databases, `node_modules/`, `.next/`, and Python cache files out of commits. Check nested guidance such as `frontend/AGENTS.md` before editing that area.
