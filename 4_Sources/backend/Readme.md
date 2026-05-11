# AIMessenger Backend

Django + Django REST Framework API для пользователей, чатов, участников и сообщений. Текущий backend использует **DRF TokenAuthentication**, не JWT.

## Быстрый запуск

```powershell
cd 4_Sources/backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
cd ..
Copy-Item backend\.env .env
docker compose -f docker-compose.local.yml up -d postgres redis
cd backend
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py createsuperuser
.\.venv\Scripts\python manage.py runserver
```

Проверки:

```powershell
.\.venv\Scripts\python manage.py check
.\.venv\Scripts\python manage.py test users chats messages
```

Демо-данные для показа:

```powershell
.\.venv\Scripts\python manage.py seed_demo_data
```

Команда идемпотентная: повторный запуск не создаёт дубли. Пароль демо-пользователей: `DemoPassword123`.

## Авторизация

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
 
Дальше frontend отправляет:

```http
Authorization: Token <token>
```

Актуальные публичные auth endpoints:

| Method | URL | Назначение |
|---|---|---|
| `POST` | `/api/register/` | Регистрация |
| `POST` | `/api/auth/token/` | Получение DRF token |
| `GET` | `/api/me/` | Текущий пользователь по token |

`/api/auth/login/` из DRF browsable API существует для session login в браузере, но основной контракт frontend -> backend: `/api/auth/token/`.

## Сверка с системной моделью

| Документ/ожидание | Текущий backend | Решение на sprint |
|---|---|---|
| JWT login | DRF `TokenAuthentication` | Фиксируем `Authorization: Token <token>` |
| `/api/auth/register/` | `/api/register/` | Документируем фактический endpoint |
| `/api/chats/{id}/messages/` | `/api/messages/?chat=<id>` | Фиксируем query param, nested endpoint не добавлен |
| `/api/chats/{id}/members/` | `/api/chat-members/?chat=<id>` | Фиксируем query param |
| Асинхронная ML-классификация | Временная синхронная классификация при создании сообщения | Результат хранится в `MessageClassification`; будущая схема ниже |

## Пагинация

Все list endpoints DRF возвращают:

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

## Users API

`GET /api/me/` возвращает профиль текущего пользователя:

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

`/api/users/` доступен только project admin: `is_staff`, `is_superuser` или `role = "admin"`.

Query params:

| Param | Values | Пример |
|---|---|---|
| `role` | `user`, `admin` | `/api/users/?role=admin` |
| `status` | `active`, `inactive`, `blocked` | `/api/users/?status=active` |

Пример `/api/users/`:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "first_name": "Admin",
      "last_name": "User",
      "birth_date": null,
      "phone_number": null,
      "accepted_user_agreement": false,
      "accepted_privacy_policy": false,
      "user_agreement_accepted_at": null,
      "privacy_policy_accepted_at": null,
      "blocked_until": null,
      "role": "admin",
      "is_active": true
    }
  ]
}
```

Админ может менять `role`, `is_active`, `blocked_until`. Поле `password` принимается только на запись и никогда не возвращается.

Admin summary:

| Method | URL | Доступ |
|---|---|---|
| `GET` | `/api/admin/events/` | Только project admin |

Response содержит `latest_registrations`, `created_chats`, `messages_last_24h`, `active_users_last_24h`.

### Контакты и поиск пользователей

Авторизованные пользователи могут искать других активных пользователей и вести личный список контактов.

| Method | URL | Назначение |
|---|---|---|
| `GET` | `/api/user-search/?q=<text>` | Поиск активных пользователей по username, email, имени, фамилии или телефону. Текущий пользователь исключается из выдачи. |
| `GET` | `/api/contacts/` | Список контактов текущего пользователя. Project admin видит все записи контактов. |
| `POST` | `/api/contacts/` | Добавить пользователя в контакты: `{"contact": 2}`. |
| `DELETE` | `/api/contacts/{id}/` | Удалить запись контакта. |
| `POST` | `/api/contacts/{id}/direct-chat/` | Создать или переиспользовать личный чат с контактом. Возвращает `{"chat": 10, "created": true}`. |
| `POST` | `/api/contacts/{id}/add-to-chat/` | Добавить контакт в групповой или корпоративный чат. Body: `{"chat": 10, "role": "member"}`. Добавлять участников может только owner/admin чата или project admin. |

Contact response:

```json
{
  "id": 1,
  "owner": 1,
  "contact": 2,
  "contact_detail": {
    "id": 2,
    "username": "user2",
    "email": "user2@example.com",
    "first_name": "User",
    "last_name": "Two",
    "role": "user"
  },
  "created_at": "2026-05-11T08:00:00Z"
}
```

## Chats API

Base URL: `/api/chats/`

Поля `Chat`:

| Поле | Описание |
|---|---|
| `id` | ID чата |
| `title` | Название |
| `chat_type` | `direct`, `group`, `corporate` |
| `description` | Описание |
| `created_by` | ID создателя |
| `members_count` | Количество участников |
| `members` | Участники с `id`, `user`, `username`, `user_detail`, `role`, `joined_at` |
| `last_message` | Последнее сообщение для списка чатов или `null` |
| `created_at`, `updated_at` | Timestamps |

Query params:

| Param | Values | Пример |
|---|---|---|
| `type` | `direct`, `group`, `corporate` | `/api/chats/?type=direct` |

Пример `/api/chats/`:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 10,
      "title": "Sprint planning",
      "chat_type": "group",
      "description": "Group chat",
      "created_by": 1,
      "members_count": 2,
      "members": [
        {
          "id": 100,
          "chat": 10,
          "user": 1,
          "username": "demo",
          "user_detail": {
            "id": 1,
            "username": "demo",
            "email": "demo@example.com",
            "first_name": "Demo",
            "last_name": "User",
            "role": "user"
          },
          "role": "owner",
          "joined_at": "2026-05-11T08:00:00Z"
        }
      ],
      "last_message": {
        "id": 50,
        "text": "Привет",
        "sender": 1,
        "sender_username": "demo",
        "message_type": "default",
        "task_status": "none",
        "created_at": "2026-05-11T08:01:00Z"
      },
      "created_at": "2026-05-11T08:00:00Z",
      "updated_at": "2026-05-11T08:01:00Z"
    }
  ]
}
```

Создание direct-чата:

```json
{
  "chat_type": "direct",
  "direct_user_id": 2
}
```

Backend запрещает дубль direct-чата для одной пары пользователей и автоматически добавляет обоих участников. Создатель получает роль `owner`, второй пользователь - `member`.

Создание group/corporate-чата:

```json
{
  "title": "Project chat",
  "chat_type": "corporate",
  "description": "Main project room",
  "participant_ids": [2, 3]
}
```

Создатель становится `owner`, участники из `participant_ids` добавляются как `member`.

## Chat Members API

Base URL: `/api/chat-members/`

Query params:

| Param | Пример |
|---|---|
| `chat` | `/api/chat-members/?chat=10` |

Добавлять/изменять участников может только `owner`/`admin` чата или project admin.

Request:

```json
{
  "chat": 10,
  "user": 2,
  "role": "member"
}
```

## Messages API

Base URL: `/api/messages/`

Query params:

| Param | Пример |
|---|---|
| `chat` | `/api/messages/?chat=10` |

Поля `Message`:

| Поле | Описание |
|---|---|
| `id` | ID сообщения |
| `chat` | ID чата |
| `sender` | ID автора, read-only |
| `sender_username` | Username автора |
| `text` | Текст |
| `message_type` | `default`, `question`, `task` |
| `task_status` | `none`, `todo`, `in_progress`, `done` |
| `analyst_notes` | Заметки аналитика |
| `classification` | ML-результат или `null` |
| `created_at`, `updated_at` | Timestamps |

Пример `/api/messages/?chat=10`:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 50,
      "chat": 10,
      "sender": 1,
      "sender_username": "demo",
      "text": "Нужно подготовить демо",
      "message_type": "task",
      "task_status": "todo",
      "analyst_notes": "",
      "classification": {
        "label": "task",
        "confidence": 0.75,
        "probabilities": {
          "task": 0.75
        },
        "classified_at": "2026-05-11T08:01:00Z"
      },
      "created_at": "2026-05-11T08:01:00Z",
      "updated_at": "2026-05-11T08:01:00Z"
    }
  ]
}
```

Создание сообщения:

```json
{
  "chat": 10,
  "text": "Нужно подготовить демо",
  "message_type": "task",
  "task_status": "todo",
  "analyst_notes": ""
}
```

Правила:

- обычный пользователь видит только сообщения своих чатов;
- создавать сообщение можно только при членстве в чате;
- редактировать/удалять сообщение может автор, `owner`/`admin` чата или project admin;
- если `message_type != "task"`, то `task_status` должен быть `none`.

## ML-классификация

При создании сообщения backend синхронно вызывает временную классификацию:

1. пытается загрузить `4_Sources/ml-service/predictor.py`;
2. если модель или зависимости недоступны, использует безопасный mock fallback;
3. сохраняет результат в `MessageClassification`;
4. возвращает результат в `MessageSerializer.classification`.

Хранимые поля:

| Поле | Описание |
|---|---|
| `label` | Метка класса |
| `confidence` | Максимальная вероятность |
| `probabilities` | JSON распределения вероятностей |
| `classified_at` | Время классификации |

Будущая асинхронная схема:

1. `POST /api/messages/` сохраняет сообщение и возвращает `201 Created`;
2. backend ставит Celery task `classify_message(message_id)`;
3. Redis используется как broker;
4. worker вызывает ML-service;
5. worker обновляет `MessageClassification`;
6. если ML-service недоступен, task пишет fallback-результат или оставляет `classification = null` и уходит в retry/backoff.

## Права доступа

Project admin: `is_staff`, `is_superuser` или `role = "admin"`. Он имеет полный доступ к users/chats/messages.

Обычный пользователь:

- видит только свои чаты;
- видит только сообщения своих чатов;
- видит участников только своих чатов;
- не может добавлять участников, если не `owner`/`admin` чата;
- не может создавать сообщения в чужом чате;
- не может редактировать/удалять чужие сообщения без роли `owner`/`admin`.

## Ошибки API

Нет token:

```json
{
  "detail": "Authentication credentials were not provided."
}
```

Невалидный token:

```json
{
  "detail": "Invalid token."
}
```

Нет прав:

```json
{
  "detail": "You do not have permission to perform this action."
}
```

Объект скрыт правами или не найден:

```json
{
  "detail": "No Chat matches the given query."
}
```

## Обновление классификации сообщений

Классификация пересчитывается при `POST /api/messages/`, а также при `PATCH`/`PUT`, если изменился `Message.text`. Существующая запись `MessageClassification` обновляется вместе с новым `classified_at`.

## Security checklist

- Пароль не сохраняется во frontend `localStorage`; там хранится только `auth_token`.
- Пароль не возвращается API: поля `password` write-only.
- Пароль не пишется backend-логами; кастомного логирования request body нет.
- Пользователь создаётся через `create_user()`/`set_password()`, в Django admin хранится hash пароля.
- Статические demo-пользователи frontend не содержат пароль.

## Переменные окружения

Создайте `.env` из `.env.example`:

```powershell
Copy-Item .env.example .env
```

Основные переменные:

| Переменная | Назначение |
|---|---|
| `SECRET_KEY` | Обязательный Django secret |
| `DEBUG` | `True` локально, `False` на сервере |
| `ALLOWED_HOSTS` | Хосты через запятую |
| `API_PAGE_SIZE` | Размер страницы list endpoints |
| `CORS_ALLOWED_ORIGINS` | Разрешённые frontend origins |
| `POSTGRES_DB` | Имя базы |
| `POSTGRES_USER` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `POSTGRES_HOST` | Host PostgreSQL |
| `POSTGRES_PORT` | Port PostgreSQL, локально обычно `5433` |
| `USE_POSTGRES_FOR_TESTS` | `True`, если тесты нужно гонять на PostgreSQL; по умолчанию тесты используют SQLite |
