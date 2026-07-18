.PHONY: help build up down restart logs ps health shell

COMPOSE ?= docker compose
SERVICE ?= dashboard
PORT ?= 8000

help:
	@printf "Dashboard Docker commands:\n"
	@printf "  make build    Build Docker image\n"
	@printf "  make up       Start dashboard in background\n"
	@printf "  make down     Stop and remove containers\n"
	@printf "  make restart  Restart dashboard\n"
	@printf "  make logs     Follow container logs\n"
	@printf "  make ps       Show container status\n"
	@printf "  make health   Check API health endpoint\n"
	@printf "  make shell    Open shell in running container\n"

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart $(SERVICE)

logs:
	$(COMPOSE) logs -f $(SERVICE)

ps:
	$(COMPOSE) ps

health:
	$(COMPOSE) exec -T $(SERVICE) python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:$(PORT)/api/health', timeout=3).read().decode())"

shell:
	$(COMPOSE) exec $(SERVICE) sh
