.PHONY: setup cf rebuild-api

setup:
	npm run import:data
	npm run import:faq
	npm run seed:demo

CF_PORT ?= 3000

cf:
	cloudflared tunnel --url http://localhost:$(CF_PORT)

API_SERVICES ?= hert-hospital-mcp chatbot-api

rebuild-api:
	docker compose up -d --build $(API_SERVICES)
