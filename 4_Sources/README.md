# AIMessenger Sources

Папка `4_Sources` содержит рабочие исходники проекта:

- `backend/` - Django + DRF API;
- `frontend/` - React/Vite frontend;
- `ml-service/` - ML-классификатор и артефакты модели;
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
- API контактов: `http://127.0.0.1:8000/api/contacts/`
- API поиска пользователей: `http://127.0.0.1:8000/api/user-search/?q=<text>`

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

Если PyPI недоступен из Docker build, можно передать альтернативный index:

```powershell
docker compose -f docker-compose.local.yml --env-file .env build --build-arg PIP_INDEX_URL=https://pypi.org/simple backend
```

Если одновременно недоступен Docker Hub, используйте зеркала для базового Python image и PyPI:

```powershell
docker compose -f docker-compose.local.yml --env-file .env build --build-arg PYTHON_IMAGE=mirror.gcr.io/library/python:3.12-slim --build-arg PIP_INDEX_URL=https://pypi.mirrors.ustc.edu.cn/simple backend
```

Backend image по умолчанию использует Python 3.12, потому что текущие Celery-зависимости стабильнее собираются на этой версии.

Backend container сам выполняет:

- `python manage.py migrate --noinput`;
- `python manage.py seed_admin_user`;
- `python manage.py collectstatic --noinput`;
- запуск `gunicorn` на `0.0.0.0:8000`.

Для демо-данных можно выполнить:

```powershell
docker compose -f docker-compose.local.yml --env-file .env exec backend python manage.py seed_demo_data
```

Если Docker Hub не скачивает образы из-за DNS/IPv6, можно заранее скачать нужные образы и проставить стандартные теги:

```powershell
docker pull docker.1ms.run/pgvector/pgvector:0.8.2-pg17-trixie
docker pull docker.1ms.run/library/node:24-alpine
docker pull docker.1ms.run/library/nginx:1.27-alpine
docker pull mirror.gcr.io/library/redis:alpine
docker tag docker.1ms.run/pgvector/pgvector:0.8.2-pg17-trixie pgvector/pgvector:0.8.2-pg17-trixie
docker tag docker.1ms.run/library/node:24-alpine node:24-alpine
docker tag docker.1ms.run/library/nginx:1.27-alpine nginx:1.27-alpine
docker tag mirror.gcr.io/library/redis:alpine redis:alpine
```

Если `python:3.12-slim` не скачивается, но локальный `aimessenger-backend:latest` уже есть, можно пересобрать backend image поверх существующего образа с уже установленными зависимостями:

```powershell
$env:BACKEND_PYTHON_IMAGE = "aimessenger-backend:latest"
$env:BACKEND_INSTALL_REQUIREMENTS = "false"
docker compose -f docker-compose.local.yml --env-file .env build backend
docker compose -f docker-compose.local.yml --env-file .env up -d --no-build --force-recreate backend
```

После пересборки проверьте, что backend отвечает актуальным кодом:

```powershell
curl.exe -I http://127.0.0.1:3000/api/
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

Media files:

- message images and profile avatars are returned by the backend as `/media/...` URLs;
- in production set `BACKEND_PUBLIC_BASE_URL=https://api.elephantaimessenger.ru` in `4_Sources/.env` so API responses contain a public media host;
- the frontend normalizes media links before rendering, including relative `/media/...` paths and accidental internal Docker hosts;
- chat messages render Telegram-style date separators (`Сегодня`, `Вчера`, or full date) above message groups from different days.

Проверка сборки:

```powershell
npm run build
```

В интерфейсе доступны:

- вложения в сообщениях через кнопку со скрепкой в composer;
- раздел `/app/settings` для изменения e-mail, телефона, пароля и аватара;
- семантический поиск внутри открытого личного или группового чата;
- кнопка "Поиск по чатам" в разделе AI Ассистент.

## ML-service

ML-интеграция работает через Celery/Redis:

- `backend-worker` слушает очередь `backend` и выполняет `messages.tasks.classify_message_task` и `messages.tasks.build_message_embedding_task`;
- `ml-worker` обязателен для полноценной классификации и embeddings, слушает очередь `ml`;
- ML-задачи `ml_service.classify_message` и `ml_service.embed_text` отправляются только в очередь `ml`;
- если `ml-worker` недоступен, backend-задача пишет fallback-классификацию и hash embedding.

Celery limits and worker sizing can be configured separately from the main app `.env`:

```powershell
Copy-Item celery.env.example celery.env
```

`celery.env` is ignored by git. It controls backend and ML worker concurrency, prefetch, max tasks per child, and hard/soft task time limits.

Для локального полного запуска используйте:

```powershell
docker compose -f docker-compose.local.yml --env-file .env up -d --build postgres redis ml-worker backend backend-worker frontend
```

Идея RAG-расширения через QWEN API описана в `RAG_QWEN_PROPOSAL.md`.

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
## Recent UI/API capabilities

- Password recovery validates reset links before showing the new-password form and supports show/hide password buttons.
- Direct and group chat messages can be edited or deleted from the message bubble actions.
- Group chat owners/admins can remove members and delete a group chat.

## Local Docker fallback without PyPI/Docker Hub

If Docker Desktop cannot resolve Docker Hub or PyPI during backend rebuild, reuse the already built backend image and skip dependency installation:

```powershell
cd 4_Sources
$env:BACKEND_PYTHON_IMAGE = "aimessenger-backend:latest"
$env:BACKEND_INSTALL_REQUIREMENTS = "false"
docker compose -f docker-compose.local.yml --env-file .env build backend
docker compose -f docker-compose.local.yml --env-file .env up -d backend frontend
```

The default build still installs `requirements.txt`; this fallback is only for local rebuilds when dependencies are already present in the base image.
