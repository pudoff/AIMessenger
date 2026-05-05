OPTIONS = --env-file .env up -d --build --force-recreate --remove-orphans

.PHONY: lf
lf:
	@echo "Нормализация окончаний файлов (CRLF -> LF)"
	find .. -type f \( -name "*.sh" -o -name "*.bash" \) \
		-not -path '*/node_modules/*' \
		-not -path '*/venv/*' \
		-not -path '*/.*' \
		-exec sed -i 's/\r$$//' {} +

.PHONY: local
local: lf
	docker compose -f docker-compose.local.yml ${OPTIONS}
