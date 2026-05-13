OPTIONS := --env-file .env up -d --build --force-recreate --remove-orphans
UNAME_S := $(shell uname -s 2>/dev/null || echo unknown)

.PHONY: lf
lf:
	@echo "Нормализация окончаний файлов (CRLF -> LF)"
	find .. -type f \( -name "*.sh" -o -name "*.bash" \) \
		-not -path '*/node_modules/*' \
		-not -path '*/venv/*' \
		-not -path '*/.*' \
		-exec sed -i 's/\r$$//' {} +

.PHONY: local
local:
	@if [ "$(UNAME_S)" != "Darwin" ]; then \
		$(MAKE) lf; \
	fi
	docker compose -f docker-compose.local.yml ${OPTIONS}

.PHONY: prod
prod:
	docker compose -f docker-compose.yml ${OPTIONS}

.PHONY: prod-pull
prod-pull:
	docker compose -f docker-compose.yml ${OPTIONS} --pull always
