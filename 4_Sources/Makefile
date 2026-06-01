ifneq (,$(wildcard .env))
    include .env
    export
endif

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

.PHONY: traefik-base-auth
traefik-base-auth:
	@if [ -z "${BASE_AUTH_PASS}" ]; then echo "BASE_AUTH_PASS is empty"; exit 1; fi
	@mkdir -p ./infra/traefik
	@printf "admin:%s\n" "$$(openssl passwd -apr1 "${BASE_AUTH_PASS}")" > ./infra/traefik/usersfile
	@echo "Generated ./infra/traefik/usersfile"
