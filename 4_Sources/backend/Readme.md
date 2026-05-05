# Backend AIMessenger

REST API на Django и Django REST Framework для пользователей, чатов, участников чатов и сообщений. Backend подготовлен для связки с frontend через DRF Token Authentication.

## Что реализовано

- Все пользовательские API, кроме регистрации и получения токена, требуют авторизацию.
- `SECRET_KEY`, `DEBUG`, параметры PostgreSQL и размер страницы вынесены в `.env`.
- Включена глобальная пагинация DRF.
- Добавлена фильтрация сообщений по чату: `GET /api/messages/?chat=<chat_id>`.
- Добавлена фильтрация участников по чату: `GET /api/chat-members/?chat=<chat_id>`.
- Добавлена регистрация: `POST /api/register/`.
- Добавлен профиль текущего пользователя для frontend: `GET /api/me/`.
- `/api/users/` оставлен как админский endpoint только для Django staff/superuser.
- Queryset'ы `chats`, `chat-members`, `messages` ограничены текущим пользователем.
- Добавлены object permissions для чатов, участников и сообщений.
- Модель пользователя расширена под требования регистрации: дата рождения, телефон, согласие с пользовательским соглашением, согласие с политикой конфиденциальности, timestamps согласий, поле `blocked_until` для будущей блокировки.
- Добавлена доменная валидация: `task_status` можно указывать только для сообщений с `message_type = "task"`.
- Добавлены API-тесты на авторизацию, регистрацию, профиль пользователя, права на чаты, участников и сообщения.

## Стек

- Python 3.12+
- Django 5.2
- Django REST Framework
- DRF Token Authentication
- PostgreSQL для разработки и запуска
- SQLite fallback только для `manage.py test`, чтобы тесты можно было гонять без поднятой PostgreSQL
- Docker Compose для локальной PostgreSQL

## Структура backend

```text
4_Sources/backend/
├── chats/             # чаты, участники, permissions, serializers, tests
├── config/            # settings.py, urls.py, wsgi/asgi
├── messages/          # сообщения, permissions, serializers, tests
├── users/             # User, регистрация, /api/me/, админский users API, tests
├── docker-compose.yml # PostgreSQL
├── manage.py
├── requirements.txt
├── .env.example
└── Readme.md
```

## Быстрый запуск на Windows

Docker Desktop должен быть запущен заранее.

```powershell
cd 4_Sources/backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
docker compose up -d
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py createsuperuser
.\.venv\Scripts\python manage.py runserver
```

После запуска:

- API: `http://127.0.0.1:8000/api/`
- админка: `http://127.0.0.1:8000/admin/`
- token login: `http://127.0.0.1:8000/api/auth/token/`

## Переменные окружения

Создайте `.env` из `.env.example`:

```powershell
Copy-Item .env.example .env
```

Пример:

```env
SECRET_KEY=django-insecure-change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
API_PAGE_SIZE=20

POSTGRES_DB=aimessenger
POSTGRES_USER=aimessenger
POSTGRES_PASSWORD=aimessenger
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
```

| Переменная | Назначение |
|---|---|
| `SECRET_KEY` | Обязательный секретный ключ Django. В production хранить только в окружении/секретах сервера. |
| `DEBUG` | `True` только локально. На сервере должно быть `False`. |
| `ALLOWED_HOSTS` | Хосты через запятую. |
| `API_PAGE_SIZE` | Размер страницы для list endpoints. По умолчанию `20`. |
| `POSTGRES_DB` | Имя базы PostgreSQL. |
| `POSTGRES_USER` | Пользователь PostgreSQL. |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL. |
| `POSTGRES_HOST` | Хост PostgreSQL. Для локального Docker Compose обычно `localhost`. |
| `POSTGRES_PORT` | Внешний порт PostgreSQL. Сейчас `5433`, потому что контейнерный `5432` проброшен наружу как `5433`. |
| `USE_POSTGRES_FOR_TESTS` | Если поставить `True`, тесты будут идти через PostgreSQL. По умолчанию тесты используют SQLite fallback. |

Файл `.env` не коммитим.

## PostgreSQL через Docker Compose

```powershell
cd 4_Sources/backend
docker compose up -d
docker compose ps
docker compose logs postgres
```

Остановить контейнер без удаления данных:

```powershell
docker compose stop
```

Остановить и удалить контейнер, но оставить volume:

```powershell
docker compose down
```

Удалить контейнер и локальные данные PostgreSQL:

```powershell
docker compose down -v
```

## Проверки

Быстрая проверка Django:

```powershell
.\.venv\Scripts\python manage.py check
```

Тесты API:

```powershell
.\.venv\Scripts\python manage.py test
```

Проверка миграций:

```powershell
.\.venv\Scripts\python manage.py makemigrations --check --dry-run
```

Если нужно прогнать тесты именно на PostgreSQL:

```powershell
$env:USE_POSTGRES_FOR_TESTS='True'
.\.venv\Scripts\python manage.py test
```

Текущий backend проверен на поднятой PostgreSQL из Docker Compose:

- `docker compose ps` - контейнер `aimessenger-postgres` запущен на `5433`;
- `python manage.py check` - без ошибок;
- `python manage.py makemigrations --check --dry-run` - новых миграций нет;
- `python manage.py migrate` - миграции применяются;
- `USE_POSTGRES_FOR_TESTS=True python manage.py test` - 22 API-теста проходят.

## Что не должно попадать в Git

Корневой `.gitignore` уже закрывает локальные секреты, зависимости и runtime-артефакты:

- `.env`, `.env.*`, кроме `.env.example`;
- `.venv/`, `venv/`, `__pycache__/`, `*.pyc`;
- `db.sqlite3`, `*.sqlite3`, `.coverage`, `htmlcov/`;
- `node_modules/`, `.vite/`, npm/yarn/pnpm debug logs;
- `build/`, `dist/`, локальные Docker override-файлы.

Важно: `3_Prototype/dist` уже отслеживается Git'ом как существующий артефакт прототипа. Правило `dist/` защитит новые неотслеживаемые сборки, но не удаляет уже отслеживаемые файлы из индекса.

## Авторизация frontend -> backend

Используется DRF Token Authentication.

## Сверка с требованиями аналитика по регистрации и авторизации

В документации аналитика для регистрации пользователя указаны обязательные данные:

| Требование | Текущее поле/API | Статус |
|---|---|---|
| имя | `first_name` | есть, обязательно в `POST /api/register/` |
| фамилия | `last_name` | есть, обязательно в `POST /api/register/` |
| дата рождения | `birth_date` | добавлено, обязательно в `POST /api/register/` |
| логин для чата | `username` | есть, обязательно |
| мобильный телефон | `phone_number` | добавлено, обязательно, уникальное |
| email | `email` | есть, обязательно, проверяется на уникальность при регистрации |
| пользовательское соглашение | `accepted_user_agreement` | добавлено, должно быть `true` |
| политика конфиденциальности | `accepted_privacy_policy` | добавлено, должно быть `true` |
| дата принятия пользовательского соглашения | `user_agreement_accepted_at` | заполняется автоматически |
| дата принятия политики конфиденциальности | `privacy_policy_accepted_at` | заполняется автоматически |
| блокировка аккаунта | `blocked_until` | поле добавлено, сам rate-limit процесс ещё не реализован |

Что пока не реализовано как процесс:

- отправка письма со ссылкой для завершения регистрации;
- создание пароля по ссылке из письма;
- восстановление пароля по email-ссылке;
- блокировка аккаунта на 1 минуту при 10+ запросах в секунду.

Текущий MVP-сценарий отличается от BPMN аналитика: пользователь передаёт пароль сразу в `POST /api/register/`, после чего может получить token через `POST /api/auth/token/`.

### Логин

`POST /api/auth/token/`

Request:

```json
{
  "username": "demo",
  "password": "StrongPassword123"
}
```

Response:

```json
{
  "token": "0123456789abcdef..."
}
```

Дальше frontend хранит token и отправляет его во все защищённые запросы:

```http
Authorization: Token <token>
```

### Регистрация

`POST /api/register/`

Endpoint открыт без авторизации.

Request:

```json
{
  "username": "demo",
  "password": "StrongPassword123",
  "email": "demo@example.com",
  "first_name": "Demo",
  "last_name": "User",
  "birth_date": "1995-05-04",
  "phone_number": "+79990000001",
  "accepted_user_agreement": true,
  "accepted_privacy_policy": true
}
```

Response `201 Created`:

```json
{
  "id": 1,
  "username": "demo",
  "email": "demo@example.com",
  "first_name": "Demo",
  "last_name": "User",
  "birth_date": "1995-05-04",
  "phone_number": "+79990000001",
  "accepted_user_agreement": true,
  "accepted_privacy_policy": true,
  "role": "user"
}
```

Пароль в ответе не возвращается.

### Текущий пользователь

`GET /api/me/`

Headers:

```http
Authorization: Token <token>
```

Response:

```json
{
  "id": 1,
  "username": "demo",
  "email": "demo@example.com",
  "first_name": "Demo",
  "last_name": "User",
  "birth_date": "1995-05-04",
  "phone_number": "+79990000001",
  "accepted_user_agreement": true,
  "accepted_privacy_policy": true,
  "role": "user"
}
```

Роли пользователя:

- `user` - обычный пользователь;
- `admin` - Django staff/superuser.

## Правила доступа

Обычный пользователь:

- видит только чаты, где он участник;
- видит только участников своих чатов;
- видит только сообщения из своих чатов;
- может создать чат и автоматически становится `owner`;
- может писать только в чаты, где он участник;
- не может передать чужой `sender`: backend всегда берёт `sender` из `request.user`;
- может редактировать/удалять свои сообщения;
- может редактировать/удалять чужие сообщения только если он `owner/admin` этого чата;
- может менять/удалять чат только если он `owner/admin` этого чата;
- может добавлять/менять/удалять участников только если он `owner/admin` этого чата;
- не имеет доступа к `/api/users/`.

Django staff/superuser:

- видит все чаты, участников и сообщения;
- может управлять всеми чатами, участниками и сообщениями;
- имеет доступ к `/api/users/`.

## API endpoints

Все endpoints, кроме `POST /api/register/`, `POST /api/auth/token/` и DRF login pages, требуют авторизацию.

### Auth

| Method | URL | Доступ | Назначение |
|---|---|---|---|
| `POST` | `/api/auth/token/` | anyone | Получить token по `username/password`. |
| `POST` | `/api/register/` | anyone | Самостоятельная регистрация пользователя. |
| `GET` | `/api/me/` | authenticated | Данные текущего пользователя для frontend. |

### Чаты

Base URL: `/api/chats/`

| Method | URL | Доступ | Назначение |
|---|---|---|---|
| `GET` | `/api/chats/` | участник чатов | Список только своих чатов. |
| `POST` | `/api/chats/` | authenticated | Создать чат. Создатель станет `owner`. |
| `GET` | `/api/chats/{id}/` | участник чата | Получить свой чат. Чужой чат будет скрыт как `404`. |
| `PUT` | `/api/chats/{id}/` | owner/admin чата или staff | Полностью изменить чат. |
| `PATCH` | `/api/chats/{id}/` | owner/admin чата или staff | Частично изменить чат. |
| `DELETE` | `/api/chats/{id}/` | owner/admin чата или staff | Удалить чат. |

Создание чата:

```json
{
  "title": "Project chat"
}
```

### Участники чатов

Base URL: `/api/chat-members/`

| Method | URL | Доступ | Назначение |
|---|---|---|---|
| `GET` | `/api/chat-members/` | участник соответствующих чатов | Список участников только из своих чатов. |
| `GET` | `/api/chat-members/?chat=1` | участник чата | Участники конкретного своего чата. |
| `POST` | `/api/chat-members/` | owner/admin чата или staff | Добавить пользователя в чат. |
| `GET` | `/api/chat-members/{id}/` | участник соответствующего чата | Получить запись участника. |
| `PUT` | `/api/chat-members/{id}/` | owner/admin чата или staff | Полностью изменить запись участника. |
| `PATCH` | `/api/chat-members/{id}/` | owner/admin чата или staff | Частично изменить запись участника. |
| `DELETE` | `/api/chat-members/{id}/` | owner/admin чата или staff | Удалить участника. |

Добавить участника:

```json
{
  "chat": 1,
  "user": 2,
  "role": "member"
}
```

Роли участника чата:

- `owner` - владелец;
- `admin` - администратор чата;
- `member` - обычный участник.

### Сообщения

Base URL: `/api/messages/`

| Method | URL | Доступ | Назначение |
|---|---|---|---|
| `GET` | `/api/messages/` | участник чатов | Список сообщений только из своих чатов. |
| `GET` | `/api/messages/?chat=1` | участник чата | Сообщения конкретного своего чата. |
| `POST` | `/api/messages/` | участник чата | Создать сообщение в своём чате. |
| `GET` | `/api/messages/{id}/` | участник чата | Получить сообщение из своего чата. Чужое сообщение будет скрыто как `404`. |
| `PUT` | `/api/messages/{id}/` | автор, owner/admin чата или staff | Полностью изменить сообщение. |
| `PATCH` | `/api/messages/{id}/` | автор, owner/admin чата или staff | Частично изменить сообщение. |
| `DELETE` | `/api/messages/{id}/` | автор, owner/admin чата или staff | Удалить сообщение. |

Обычное сообщение:

```json
{
  "chat": 1,
  "text": "Привет",
  "message_type": "default",
  "task_status": "none",
  "analyst_notes": ""
}
```

Задача:

```json
{
  "chat": 1,
  "text": "Сделать экран логина",
  "message_type": "task",
  "task_status": "todo",
  "analyst_notes": "Важно для MVP"
}
```

Поля сообщения:

| Поле | Описание |
|---|---|
| `id` | ID сообщения. |
| `chat` | ID чата. |
| `sender` | ID отправителя. Read-only, backend подставляет `request.user`. |
| `sender_username` | Username отправителя. Read-only. |
| `text` | Текст сообщения. |
| `message_type` | `default`, `question`, `task`. |
| `task_status` | `none`, `todo`, `in_progress`, `done`. |
| `analyst_notes` | Дополнительные заметки аналитика. Может быть пустым. |
| `created_at` | Дата создания. Read-only. |
| `updated_at` | Дата обновления. Read-only. |

Доменное правило:

- если `message_type != "task"`, то `task_status` должен быть `none`;
- если передать `task_status = "todo"` для обычного сообщения, API вернёт `400 Bad Request`.

### Пользователи

Base URL: `/api/users/`

`/api/users/` - админский endpoint. Для обычного frontend-пользователя используем только:

- `POST /api/register/`;
- `POST /api/auth/token/`;
- `GET /api/me/`.

| Method | URL | Доступ | Назначение |
|---|---|---|---|
| `GET` | `/api/users/` | Django staff/superuser | Список пользователей. |
| `POST` | `/api/users/` | Django staff/superuser | Создать пользователя. |
| `GET` | `/api/users/{id}/` | Django staff/superuser | Получить пользователя. |
| `PUT/PATCH` | `/api/users/{id}/` | Django staff/superuser | Изменить пользователя. |
| `DELETE` | `/api/users/{id}/` | Django staff/superuser | Удалить пользователя. |

Поля пользователя:

| Поле | Описание |
|---|---|
| `id` | ID пользователя. |
| `username` | Логин для чата. |
| `email` | Email пользователя. При регистрации обязателен и проверяется на уникальность. |
| `first_name` | Имя. |
| `last_name` | Фамилия. |
| `birth_date` | Дата рождения в формате `YYYY-MM-DD`. |
| `phone_number` | Мобильный телефон. При регистрации обязателен и уникален. |
| `accepted_user_agreement` | Принято пользовательское соглашение. Для регистрации должно быть `true`. |
| `accepted_privacy_policy` | Принята политика конфиденциальности. Для регистрации должно быть `true`. |
| `user_agreement_accepted_at` | Когда принято пользовательское соглашение. Заполняется автоматически. |
| `privacy_policy_accepted_at` | Когда принята политика конфиденциальности. Заполняется автоматически. |
| `blocked_until` | До какого времени аккаунт заблокирован. Поле подготовлено под будущий rate-limit процесс. |
| `role` | `user` или `admin`. |
| `is_active` | Активен ли пользователь. |

## Пагинация

List endpoints возвращают DRF pagination response:

```json
{
  "count": 100,
  "next": "http://127.0.0.1:8000/api/messages/?page=2",
  "previous": null,
  "results": []
}
```

Размер страницы задаётся через `.env`:

```env
API_PAGE_SIZE=20
```

## Ошибки API

### Неверный логин/пароль или пользователь не найден

`POST /api/auth/token/`

Status: `400 Bad Request`

```json
{
  "non_field_errors": [
    "Unable to log in with provided credentials."
  ]
}
```

DRF специально не раскрывает, что именно неверно: username или password.

### Нет авторизации

Status: `401 Unauthorized`

```json
{
  "detail": "Authentication credentials were not provided."
}
```

Правильный формат заголовка:

```http
Authorization: Token <token>
```

### Нет прав

Status: `403 Forbidden`

```json
{
  "detail": "You do not have permission to perform this action."
}
```

Примеры:

- обычный участник пытается изменить чат;
- обычный участник пытается добавить пользователя в чат;
- пользователь пытается написать в чужой чат;
- обычный пользователь открывает `/api/users/`.

### Объект не найден или скрыт правами

Status: `404 Not Found`

```json
{
  "detail": "No Chat matches the given query."
}
```

Так может быть, если объект существует, но не входит в queryset текущего пользователя. Например, пользователь запрашивает чужой чат.

### Невалидные поля формы

Status: `400 Bad Request`

```json
{
  "username": [
    "A user with that username already exists."
  ],
  "password": [
    "This password is too short."
  ]
}
```

### Некорректный `task_status`

Request:

```json
{
  "chat": 1,
  "text": "Обычное сообщение",
  "message_type": "default",
  "task_status": "todo"
}
```

Status: `400 Bad Request`

```json
{
  "task_status": [
    "Статус задачи можно указывать только для сообщений типа task."
  ]
}
```

## Curl-примеры

Регистрация:

```bash
curl -X POST http://127.0.0.1:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"StrongPassword123","email":"demo@example.com","first_name":"Demo","last_name":"User","birth_date":"1995-05-04","phone_number":"+79990000001","accepted_user_agreement":true,"accepted_privacy_policy":true}'
```

Получить token:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"StrongPassword123"}'
```

Получить текущего пользователя:

```bash
curl http://127.0.0.1:8000/api/me/ \
  -H "Authorization: Token <token>"
```

Создать чат:

```bash
curl -X POST http://127.0.0.1:8000/api/chats/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Project chat"}'
```

Добавить участника:

```bash
curl -X POST http://127.0.0.1:8000/api/chat-members/ \
  -H "Authorization: Token <owner_or_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"chat":1,"user":2,"role":"member"}'
```

Создать сообщение:

```bash
curl -X POST http://127.0.0.1:8000/api/messages/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"chat":1,"text":"Привет","message_type":"default","task_status":"none"}'
```

Получить сообщения чата:

```bash
curl "http://127.0.0.1:8000/api/messages/?chat=1" \
  -H "Authorization: Token <token>"
```

## Командный чеклист ручной проверки

1. Запустить Docker Desktop.
2. Создать `.env` из `.env.example`.
3. Запустить PostgreSQL: `docker compose up -d`.
4. Применить миграции: `.\.venv\Scripts\python manage.py migrate`.
5. Запустить backend: `.\.venv\Scripts\python manage.py runserver`.
6. Зарегистрировать двух пользователей: `user1`, `user2`.
7. Получить token для каждого через `/api/auth/token/`.
8. Под token `user1` создать чат через `/api/chats/`.
9. Проверить, что `user1` видит чат в `/api/chats/`.
10. Проверить, что `user2` не видит чат `user1` в `/api/chats/`.
11. Проверить, что `user2` не может создать сообщение в чате `user1`.
12. Под token `user1` добавить `user2` в `/api/chat-members/`.
13. Проверить, что теперь `user2` видит чат и может писать в него.
14. Проверить, что `GET /api/me/` возвращает `id`, `username`, `email`, `first_name`, `last_name`, `role`.

## Частые проблемы

### `SECRET_KEY environment variable is required`

Не создан `.env` или в нём нет `SECRET_KEY`.

```powershell
Copy-Item .env.example .env
```

### Backend не подключается к PostgreSQL

Проверьте контейнер:

```powershell
docker compose ps
```

Проверьте порт в `.env`:

```env
POSTGRES_PORT=5433
```

### Docker не может скачать образ PostgreSQL

Если `docker compose up -d` падает с `TLS handshake timeout`, это проблема сетевого доступа к Docker Hub или CDN. Повторите команду позже, проверьте VPN/proxy/фаерволл или заранее скачайте образ:

```powershell
docker pull postgres:17-alpine
```

### `relation does not exist`

Не применены миграции:

```powershell
.\.venv\Scripts\python manage.py migrate
```
