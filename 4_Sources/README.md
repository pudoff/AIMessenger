# AIMessenger Sources

Папка `4_Sources` содержит рабочие исходники проекта:

- `backend/` - Django + DRF API;
- `frontend/` - React/Vite frontend;
- `ml-service/` - ML-классификатор и артефакты модели;
- `webhook/` - Node.js webhook service;
- `infra/` - инфраструктурные настройки;
- `docker-compose.local.yml` - локальная инфраструктура и backend container.

## Вариант 1. Backend на хосте, PostgreSQL/Redis в Docker

Этот вариант удобен для разработки backend из IDE.

```powershell
cd 4_Sources/backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
```

Создайте root `.env` для compose из backend `.env`, чтобы PostgreSQL был доступен с хоста на `localhost:5433`:

```powershell
cd ..
Copy-Item backend\.env .env
docker compose -f docker-compose.local.yml --env-file .env up -d postgres redis
docker compose -f docker-compose.local.yml --env-file .env ps
```

Примените миграции и создайте демо-данные:

```powershell
cd backend
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed_demo_data
.\.venv\Scripts\python manage.py runserver
```

Проверка:

```powershell
.\.venv\Scripts\python manage.py check
.\.venv\Scripts\python manage.py test users chats messages
```

URL:

- API: `http://127.0.0.1:8000/api/`
- Admin: `http://127.0.0.1:8000/admin/`
- Token login: `http://127.0.0.1:8000/api/auth/token/`

Демо-пользователи после `seed_demo_data`:

- `admin`
- `user1`
- `user2`
- `analyst`

Пароль у всех: `DemoPassword123`.

## Вариант 2. Backend + PostgreSQL + Redis в Docker

Этот вариант ближе к контейнерному запуску. Важно: для backend container переменная `POSTGRES_HOST` должна быть `postgres`, поэтому используйте `4_Sources/.env.example`, а не `backend/.env`.

```powershell
cd 4_Sources
Copy-Item .env.example .env
docker compose -f docker-compose.local.yml --env-file .env up -d --build
docker compose -f docker-compose.local.yml --env-file .env ps
```

Backend container сам выполняет:

- `python manage.py migrate --noinput`;
- `python manage.py seed_admin_user`;
- `python manage.py collectstatic --noinput`;
- запуск `gunicorn` на `0.0.0.0:8000`.

Для демо-данных можно выполнить:

```powershell
docker compose -f docker-compose.local.yml --env-file .env exec backend python manage.py seed_demo_data
```

Если Docker Hub не скачивает образы из-за DNS/IPv6, можно один раз скачать через Google mirror и проставить стандартные теги:

```powershell
docker pull mirror.gcr.io/library/postgres:18.3
docker pull mirror.gcr.io/library/redis:alpine
docker tag mirror.gcr.io/library/postgres:18.3 postgres:18.3
docker tag mirror.gcr.io/library/redis:alpine redis:alpine
```

## Frontend

В отдельном терминале:

```powershell
cd 4_Sources/frontend
npm install
npm run dev
```

По умолчанию frontend использует `VITE_API_BASE_URL=/api`. Для прямого обращения к локальному backend можно создать `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Проверка сборки:

```powershell
npm run build
```

## ML-service

На текущем backend sprint ML-интеграция временно синхронная:

- backend пытается загрузить `ml-service/predictor.py`;
- если модель или Python-зависимости недоступны, используется mock fallback;
- результат сохраняется в `MessageClassification` и возвращается в `MessageSerializer.classification`.

Отдельный сервис/Celery/Redis для ML-классификации описан как будущая схема в `backend/Readme.md`.

## Остановка

Остановить контейнеры без удаления данных:

```powershell
cd 4_Sources
docker compose -f docker-compose.local.yml --env-file .env stop
```

Остановить и удалить контейнеры, оставив volumes:

```powershell
docker compose -f docker-compose.local.yml --env-file .env down
```

Удалить контейнеры и локальные данные PostgreSQL:

```powershell
docker compose -f docker-compose.local.yml --env-file .env down -v
```

## Что не коммитим

В git должны попадать `.env.example`, lock-файлы, Dockerfile, compose и исходники.

В git не должны попадать:

- реальные `.env`;
- `.venv/`, `node_modules/`;
- `dist/`, `.vite/`;
- `__pycache__/`, `*.pyc`;
- SQLite test DB;
- `staticfiles/`;
- coverage/cache/log файлы.
