# Backend AIMessenger

Backend на Django с Django REST Framework, PostgreSQL, расширенной моделью пользователя, чатами и сообщениями.

## Что уже настроено

- Django-проект `config`.
- Приложения `users`, `chats`, `messages`.
- Django REST Framework.
- PostgreSQL через переменные окружения.
- Базовая авторизация DRF: session, basic и token auth.
- Админ-панель Django.
- Основные модели: `User`, `Chat`, `ChatMember`, `Message`.

## Локальный запуск

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
docker compose up -d
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py createsuperuser
.\.venv\Scripts\python manage.py runserver
```

Админ-панель будет доступна по адресу: `http://127.0.0.1:8000/admin/`

## PostgreSQL

По умолчанию проект ожидает PostgreSQL на `localhost:5433`.

Данные подключения из `.env.example`:

```env
POSTGRES_DB=aimessenger
POSTGRES_USER=aimessenger
POSTGRES_PASSWORD=aimessenger
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
```

Для запуска базы используется `docker-compose.yml`:

```powershell
docker compose up -d
```

Остановить базу:

```powershell
docker compose down
```

## API

Базовые эндпоинты:

- `GET /api/chats/`
- `GET /api/chat-members/`
- `GET /api/messages/`
- `POST /api/auth/token/`

Все API-эндпоинты требуют авторизацию, кроме стандартной страницы входа DRF и получения токена.

## Админ-панель

В админке зарегистрированы:

- пользователи;
- чаты;
- участники чатов;
- сообщения.

Для создания администратора:

```powershell
.\.venv\Scripts\python manage.py createsuperuser
```
