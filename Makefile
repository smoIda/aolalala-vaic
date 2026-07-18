.PHONY: help up backend dashboard down backend-down dashboard-down logs backend-logs dashboard-logs ps health backend-health dashboard-health

COMPOSE ?= docker compose
BACKEND_DIR ?= backend
DASHBOARD_DIR ?= Dashboard

help:
	@printf "Quick start services:\n"
	@printf "  make up             Start backend and dashboard\n"
	@printf "  make backend        Start backend stack\n"
	@printf "  make dashboard      Start dashboard stack\n"
	@printf "  make down           Stop backend and dashboard\n"
	@printf "  make logs           Follow backend and dashboard logs\n"
	@printf "  make ps             Show service status\n"
	@printf "  make health         Check backend and dashboard health\n"
	@printf "\nBackend URLs:\n"
	@printf "  chatbot-api:      http://localhost:3000\n"
	@printf "  hert-hospital-mcp http://localhost:15000\n"
	@printf "  adminer:          http://localhost:18080\n"
	@printf "\nDashboard URL:\n"
	@printf "  http://localhost:8000\n"

up: backend dashboard

backend:
	$(COMPOSE) --project-directory $(BACKEND_DIR) -f $(BACKEND_DIR)/docker-compose.yml up -d --build

dashboard:
	$(MAKE) -C $(DASHBOARD_DIR) up

down: backend-down dashboard-down

backend-down:
	$(COMPOSE) --project-directory $(BACKEND_DIR) -f $(BACKEND_DIR)/docker-compose.yml down

dashboard-down:
	$(MAKE) -C $(DASHBOARD_DIR) down

logs:
	@printf "Use 'make backend-logs' or 'make dashboard-logs' to follow one stack.\n"

backend-logs:
	$(COMPOSE) --project-directory $(BACKEND_DIR) -f $(BACKEND_DIR)/docker-compose.yml logs -f

dashboard-logs:
	$(MAKE) -C $(DASHBOARD_DIR) logs

ps:
	$(COMPOSE) --project-directory $(BACKEND_DIR) -f $(BACKEND_DIR)/docker-compose.yml ps
	$(MAKE) -C $(DASHBOARD_DIR) ps

health: backend-health dashboard-health

backend-health:
	@curl -fsS http://localhost:3000/health
	@printf "\n"
	@curl -fsS http://localhost:15000/health
	@printf "\n"

dashboard-health:
	$(MAKE) -C $(DASHBOARD_DIR) health
