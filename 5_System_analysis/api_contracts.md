# API Контракты — AI Messenger (MVP)


## Глобальный формат ошибок

Все ошибки DRF возвращают JSON. Фронтенд должен различать три формата:

### Ошибка аутентификации — 401
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### Ошибка прав — 403
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### Объект не найден (или скрыт правами) — 404
```json
{
  "detail": "No Chat matches the given query."
}
```

### Ошибки валидации полей — 400
```json
{
  "username": ["A user with that username already exists."],
  "email": ["Enter a valid email address."],
  "non_field_errors": ["Unable to log in with provided credentials."]
}
```
> `non_field_errors` — ошибки, не относящиеся к конкретному полю (например, неверная связка login/password).

### Серверная ошибка — 500
```json
{
  "detail": "Internal Server Error."
}
```

---

## Таблица прав доступа

| Роль | Описание |
|------|----------|
| `anonymous` | Не авторизован. Только публичные эндпоинты. |
| `user` | Аутентифицирован. Видит только свои данные. |
| `chat_member` | Участник конкретного чата. |
| `chat_owner` | Участник с ролью `owner` или `admin` в конкретном чате. |
| `staff` | Django staff/superuser. Полный доступ. |

---

## 1. Аутентификация и пользователи

### `POST /api/auth/token/` — Получить токен

**Auth:** не требуется  
**Доступ:** `anonymous`

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `username` | string | ✅ | Логин пользователя |
| `password` | string | ✅ | Пароль |

```json
{
  "username": "demo",
  "password": "StrongPassword123"
}
```

**Response 200 OK:**
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
}
```
> После успешного ответа frontend сохраняет `token` и отправляет его во всех защищённых запросах:  
> `Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b`

**Response 400 Bad Request** — неверные учётные данные:
```json
{
  "non_field_errors": [
    "Unable to log in with provided credentials."
  ]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Токен выдан |
| 400 | Неверный username / password |

---

### `POST /api/register/` — Регистрация

**Auth:** не требуется  
**Доступ:** `anonymous`

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `username` | string | ✅ | Уникальный логин |
| `password` | string | ✅ | Пароль (мин. 8 символов) |
| `email` | string (email) | ✅ | Уникальный email |
| `first_name` | string | ✅ | Имя |
| `last_name` | string | ✅ | Фамилия |
| `birth_date` | string (YYYY-MM-DD) | ✅ | Дата рождения |
| `phone_number` | string | ✅ | Уникальный номер, формат `+7XXXXXXXXXX` |
| `accepted_user_agreement` | boolean | ✅ | Должно быть `true` |
| `accepted_privacy_policy` | boolean | ✅ | Должно быть `true` |

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

**Response 201 Created:**
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
> Пароль в ответе **не** возвращается.

**Response 400 Bad Request** — ошибки валидации:
```json
{
  "username": ["A user with that username already exists."],
  "email": ["user with this email already exists."],
  "phone_number": ["user with this phone number already exists."],
  "password": ["This password is too short. It must contain at least 8 characters."],
  "accepted_user_agreement": ["You must accept the user agreement."]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 201 | Пользователь создан |
| 400 | Ошибки валидации полей |

---

### `GET /api/me/` — Текущий пользователь

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

**Query parameters:** нет

**Response 200 OK:**
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

> `role`: `"user"` — обычный пользователь, `"admin"` — Django staff/superuser.

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Данные пользователя |
| 401 | Токен не передан или невалиден |

---

### `GET /api/users/` — Список пользователей *(только admin)*

**Auth:** `Authorization: Token <token>`  
**Доступ:** `staff`

**Query parameters:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы |

**Response 200 OK:**
```json
{
  "count": 42,
  "next": "http://127.0.0.1:8000/api/users/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "username": "demo",
      "email": "demo@example.com",
      "first_name": "Demo",
      "last_name": "User",
      "birth_date": "1995-05-04",
      "phone_number": "+79990000001",
      "role": "user",
      "is_active": true,
      "blocked_until": null
    }
  ]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Список пользователей |
| 401 | Не авторизован |
| 403 | Нет прав staff |

---

## 2. Чаты

### `GET /api/chats/` — Список своих чатов

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user` (видит только свои чаты)

**Query parameters:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы (default: 1) |

**Response 200 OK:**
```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Project Alpha",
      "created_by": 1,
      "is_active": true,
      "created_at": "2026-05-01T10:00:00Z",
      "updated_at": "2026-05-18T09:30:00Z"
    },
    {
      "id": 2,
      "title": "Team Standup",
      "created_by": 3,
      "is_active": true,
      "created_at": "2026-04-15T08:00:00Z",
      "updated_at": "2026-05-17T18:00:00Z"
    }
  ]
}
```

> ⚠️ Данные находятся в `results`, а не на верхнем уровне ответа.

---

### `POST /api/chats/` — Создать чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `title` | string | ✅ | Название чата |

```json
{
  "title": "Project Alpha"
}
```

**Response 201 Created:**
```json
{
  "id": 1,
  "title": "Project Alpha",
  "created_by": 1,
  "is_active": true,
  "created_at": "2026-05-18T12:00:00Z",
  "updated_at": "2026-05-18T12:00:00Z"
}
```
> Создатель автоматически получает роль `owner` в `chat_members`.

**Response 400 Bad Request:**
```json
{
  "title": ["This field may not be blank."]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 201 | Чат создан |
| 400 | Ошибки валидации |
| 401 | Не авторизован |

---

### `GET /api/chats/{id}/` — Получить чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

**Response 200 OK:**
```json
{
  "id": 1,
  "title": "Project Alpha",
  "created_by": 1,
  "is_active": true,
  "created_at": "2026-05-01T10:00:00Z",
  "updated_at": "2026-05-18T09:30:00Z"
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Данные чата |
| 401 | Не авторизован |
| 404 | Чат не найден **или** пользователь не является участником |

---

### `PATCH /api/chats/{id}/` — Изменить чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

**Request body** (все поля опциональны):
```json
{
  "title": "Project Alpha — Final"
}
```

**Response 200 OK:**
```json
{
  "id": 1,
  "title": "Project Alpha — Final",
  "created_by": 1,
  "is_active": true,
  "created_at": "2026-05-01T10:00:00Z",
  "updated_at": "2026-05-18T14:00:00Z"
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Чат обновлён |
| 400 | Ошибки валидации |
| 401 | Не авторизован |
| 403 | Нет прав (не owner/admin/staff) |
| 404 | Чат не найден |

---

### `DELETE /api/chats/{id}/` — Удалить чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

**Response 204 No Content** — тело ответа пустое.

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 204 | Чат удалён |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Чат не найден |

---

## 3. Участники чата

### `GET /api/chat-members/` — Список участников

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user` (только участники своих чатов)

**Query parameters:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `chat` | integer | ✅ Рекомендуется — ID чата для фильтрации |
| `page` | integer | Номер страницы |

**Response 200 OK:**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "chat": 1,
      "user": 1,
      "role": "owner",
      "joined_at": "2026-05-01T10:00:00Z"
    },
    {
      "id": 2,
      "chat": 1,
      "user": 2,
      "role": "member",
      "joined_at": "2026-05-02T08:00:00Z"
    }
  ]
}
```

---

### `POST /api/chat-members/` — Добавить участника

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `chat` | integer | ✅ | ID чата |
| `user` | integer | ✅ | ID добавляемого пользователя |
| `role` | string | ✅ | `"owner"` / `"admin"` / `"member"` |

```json
{
  "chat": 1,
  "user": 2,
  "role": "member"
}
```

**Response 201 Created:**
```json
{
  "id": 3,
  "chat": 1,
  "user": 2,
  "role": "member",
  "joined_at": "2026-05-18T12:30:00Z"
}
```

**Response 400 Bad Request** — пользователь уже в чате:
```json
{
  "non_field_errors": [
    "The fields chat, user must make a unique set."
  ]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 201 | Участник добавлен |
| 400 | Ошибки валидации / пользователь уже в чате |
| 401 | Не авторизован |
| 403 | Нет прав (не owner/admin/staff) |
| 404 | Чат или пользователь не найден |

---

### `PATCH /api/chat-members/{id}/` — Изменить роль участника

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

```json
{
  "role": "admin"
}
```

**Response 200 OK:**
```json
{
  "id": 2,
  "chat": 1,
  "user": 2,
  "role": "admin",
  "joined_at": "2026-05-02T08:00:00Z"
}
```

---

### `DELETE /api/chat-members/{id}/` — Удалить участника

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

**Response 204 No Content**

---

## 4. Сообщения

> **Важно:** URL для сообщений — `/api/messages/?chat=<id>`, а **не** `/api/chats/{id}/messages/`.  
> Нейминг выровнен с реальной реализацией backend.

### `GET /api/messages/` — Список сообщений

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

**Query parameters:**

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `chat` | integer | ✅ | ID чата |
| `page` | integer | | Номер страницы |

**Response 200 OK:**
```json
{
  "count": 135,
  "next": "http://127.0.0.1:8000/api/messages/?chat=1&page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "chat": 1,
      "sender": 1,
      "sender_username": "demo",
      "text": "Привет всем!",
      "message_type": "default",
      "task_status": "none",
      "analyst_notes": "",
      "created_at": "2026-05-18T10:00:00Z",
      "updated_at": "2026-05-18T10:00:00Z"
    },
    {
      "id": 2,
      "chat": 1,
      "sender": 2,
      "sender_username": "alice",
      "text": "Кто берёт задачу по логину?",
      "message_type": "question",
      "task_status": "none",
      "analyst_notes": "",
      "created_at": "2026-05-18T10:05:00Z",
      "updated_at": "2026-05-18T10:05:00Z"
    }
  ]
}
```

> Список всегда в `results`. `count` — общее количество сообщений в чате (используется для подсчёта страниц: `Math.ceil(count / page_size)`).

---

### `POST /api/messages/` — Отправить сообщение

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `chat` | integer | ✅ | ID чата |
| `text` | string | ✅ | Текст сообщения |
| `message_type` | string | | `"default"` / `"question"` / `"task"` (default: `"default"`) |
| `task_status` | string | | `"none"` / `"todo"` / `"in_progress"` / `"done"` (default: `"none"`) |
| `analyst_notes` | string | | Заметки аналитика (default: `""`) |

> `sender` — **не передаётся** в request. Backend автоматически подставляет `request.user`.

**Обычное сообщение:**
```json
{
  "chat": 1,
  "text": "Привет всем!",
  "message_type": "default",
  "task_status": "none",
  "analyst_notes": ""
}
```

**Сообщение-задача:**
```json
{
  "chat": 1,
  "text": "Сделать экран логина",
  "message_type": "task",
  "task_status": "todo",
  "analyst_notes": "Важно для MVP"
}
```

**Response 201 Created:**
```json
{
  "id": 42,
  "chat": 1,
  "sender": 1,
  "sender_username": "demo",
  "text": "Привет всем!",
  "message_type": "default",
  "task_status": "none",
  "analyst_notes": "",
  "created_at": "2026-05-18T15:00:00Z",
  "updated_at": "2026-05-18T15:00:00Z"
}
```

**Response 400 Bad Request** — нарушено доменное правило `task_status`:
```json
{
  "task_status": [
    "Статус задачи можно указывать только для сообщений типа task."
  ]
}
```

**Response 400 Bad Request** — попытка написать в чужой чат:
```json
{
  "chat": [
    "Invalid pk \"99\" - object does not exist."
  ]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 201 | Сообщение создано |
| 400 | Ошибки валидации / нарушение доменного правила |
| 401 | Не авторизован |
| 403 | Не участник чата |

---

### `PATCH /api/messages/{id}/` — Изменить сообщение

**Auth:** `Authorization: Token <token>`  
**Доступ:** автор сообщения, `chat_owner`, или `staff`

```json
{
  "text": "Сделать экран логина (обновлено)",
  "task_status": "in_progress"
}
```

**Response 200 OK:**
```json
{
  "id": 42,
  "chat": 1,
  "sender": 1,
  "sender_username": "demo",
  "text": "Сделать экран логина (обновлено)",
  "message_type": "task",
  "task_status": "in_progress",
  "analyst_notes": "Важно для MVP",
  "created_at": "2026-05-18T15:00:00Z",
  "updated_at": "2026-05-18T15:30:00Z"
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Обновлено |
| 400 | Ошибки валидации |
| 401 | Не авторизован |
| 403 | Нет прав (не автор и не owner/admin/staff) |
| 404 | Сообщение не найдено |

---

### `DELETE /api/messages/{id}/` — Удалить сообщение

**Auth:** `Authorization: Token <token>`  
**Доступ:** автор, `chat_owner`, или `staff`

**Response 204 No Content**

---

## 5. Семантический поиск

### `GET /api/search/` — Семантический поиск по сообщениям

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

**Query parameters:**

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `q` | string | ✅ | Поисковый запрос (по смыслу) |
| `chat_id` | integer | ✅ | ID чата |
| `page` | integer | | Номер страницы |

**Пример запроса:** `GET /api/search/?q=кто+отвечает+за+дедлайн&chat_id=1`

**Response 200 OK:**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 17,
      "chat": 1,
      "sender": 2,
      "sender_username": "alice",
      "text": "Анна берёт на себя дедлайн по спринту",
      "message_type": "default",
      "task_status": "none",
      "analyst_notes": "",
      "similarity_score": 0.923,
      "created_at": "2026-05-10T09:00:00Z"
    },
    {
      "id": 23,
      "chat": 1,
      "sender": 3,
      "sender_username": "anna",
      "text": "Да, я закрою задачу до пятницы",
      "message_type": "task",
      "task_status": "in_progress",
      "analyst_notes": "",
      "similarity_score": 0.887,
      "created_at": "2026-05-10T09:15:00Z"
    }
  ]
}
```

> `similarity_score` — косинусное сходство (0 до 1). Чем выше — тем релевантнее.  
> Поиск идёт **по смыслу**, а не по ключевым словам — через pgvector `<=>` оператор.

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Результаты поиска |
| 400 | Не передан `q` или `chat_id` |
| 401 | Не авторизован |
| 403 | Не участник чата |

---

## 6. AI-ассистент

### `POST /api/assistant/` — Запрос к AI-ассистенту

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `question` | string | ✅ | Вопрос пользователя |
| `chat_id` | integer | ✅ | ID чата (контекст для RAG) |

```json
{
  "question": "Кто отвечает за задачу по логину?",
  "chat_id": 1
}
```

**Response 202 Accepted** — задача поставлена в очередь:
```json
{
  "task_id": "d3b07384-d9a2-4e5c-8d3c-1a2b3c4d5e6f",
  "status": "queued",
  "message": "Ответ будет доставлен через WebSocket."
}
```

> Backend немедленно возвращает `202`. Ответ AI придёт асинхронно через WebSocket-событие `ai_response`.  
> Frontend должен подписаться на `/ws/chats/{chat_id}/` до отправки запроса.

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 202 | Задача принята в очередь Celery |
| 400 | Не передан `question` или `chat_id` |
| 401 | Не авторизован |
| 403 | Не участник чата |
| 500 | Redis/Celery недоступен |

---

## 7. WebSocket — `/ws/chats/{id}/`

**Auth:** токен передаётся в query string: `/ws/chats/1/?token=<token>`  
**Доступ:** `chat_member`

### Подключение

```js
const ws = new WebSocket(
  `ws://127.0.0.1:8000/ws/chats/1/?token=${localStorage.getItem('token')}`
);
```

### Event types (server → client)

Все события имеют единую обёртку:
```json
{
  "event": "<event_type>",
  "payload": { ... }
}
```

#### `new_message` — новое сообщение в чате
```json
{
  "event": "new_message",
  "payload": {
    "id": 42,
    "chat": 1,
    "sender": 2,
    "sender_username": "alice",
    "text": "Привет!",
    "message_type": "default",
    "task_status": "none",
    "created_at": "2026-05-18T15:00:00Z"
  }
}
```

#### `message_updated` — сообщение изменено
```json
{
  "event": "message_updated",
  "payload": {
    "id": 42,
    "text": "Привет (исправлено)!",
    "task_status": "done",
    "updated_at": "2026-05-18T15:10:00Z"
  }
}
```

#### `message_deleted` — сообщение удалено
```json
{
  "event": "message_deleted",
  "payload": {
    "id": 42
  }
}
```

#### `ai_response` — ответ AI-ассистента готов
```json
{
  "event": "ai_response",
  "payload": {
    "task_id": "d3b07384-d9a2-4e5c-8d3c-1a2b3c4d5e6f",
    "message_id": 99,
    "content": "Ответственный за задачу по логину — Анна (на основе сообщений чата от 10 мая).",
    "message_type": "assistant",
    "created_at": "2026-05-18T15:02:30Z"
  }
}
```

#### `label_updated` — ML-сервис классифицировал сообщение (асинхронно)
```json
{
  "event": "label_updated",
  "payload": {
    "message_id": 42,
    "label": "question"
  }
}
```

#### `error` — ошибка в WS-канале
```json
{
  "event": "error",
  "payload": {
    "code": "permission_denied",
    "message": "You are not a member of this chat."
  }
}
```

### Event types (client → server)

#### `ping` — проверка соединения
```json
{
  "event": "ping"
}
```

**Server response:**
```json
{
  "event": "pong"
}
```

---

## 8. ML Service (FastAPI)

> Базовый URL ML Service: `http://ml-service:8001` (внутренняя сеть Docker).  
> Frontend **напрямую с ML Service не общается** — только через Backend/Celery.

### `POST /classify` — Классификация сообщения

**Auth:** API key в заголовке: `X-API-Key: <internal_key>`  
**Вызывает:** Celery Worker

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `text` | string | ✅ | Текст для классификации |
| `message_id` | string (UUID) | | ID сообщения (для логирования) |

```json
{
  "text": "Кто возьмёт задачу по экрану логина?",
  "message_id": "d3b07384-d9a2-4e5c-8d3c-1a2b3c4d5e6f"
}
```

**Response 200 OK:**
```json
{
  "label": "question",
  "confidence": 0.94,
  "probabilities": {
    "question": 0.94,
    "task": 0.04,
    "statement": 0.01,
    "offtopic": 0.01
  },
  "model": "classify-v1",
  "processing_time_ms": 45
}
```

> `label`: одно из `"question"` / `"task"` / `"statement"` / `"offtopic"`.  
> `confidence` < 0.5 → Celery может сохранить `label = null` и не обновлять поле.

**Response 422 Unprocessable Entity** — пустой текст:
```json
{
  "detail": [
    {
      "loc": ["body", "text"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Response 503 Service Unavailable** — модель не загружена:
```json
{
  "detail": "ML model is not ready. Retry after 30 seconds.",
  "retry_after": 30
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Классификация выполнена |
| 422 | Ошибка валидации входных данных |
| 503 | Модель недоступна (fallback: `label = null`) |
| 504 | Timeout (> 10 сек) → Celery retry |

> **Timeout / Fallback**: если ML Service не ответил за 10 секунд, Celery делает retry (макс. 3 попытки). После 3 неудач `label` остаётся `null`, задача помечается как `failed`.

---

### `POST /embed` — Получить вектор (эмбеддинг)

**Auth:** `X-API-Key: <internal_key>`  
**Вызывает:** Celery Worker

**Request body:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `text` | string | ✅ | Текст для векторизации |
| `model` | string | | Название модели (default: `"text-embedding-3-small"`) |

```json
{
  "text": "Кто отвечает за дедлайн по спринту?",
  "model": "text-embedding-3-small"
}
```

**Response 200 OK:**
```json
{
  "vector": [0.023, -0.117, 0.445, "...1536 значений..."],
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "processing_time_ms": 120
}
```

**Response 422 Unprocessable Entity:**
```json
{
  "detail": [
    {
      "loc": ["body", "text"],
      "msg": "ensure this value has at most 8192 characters",
      "type": "value_error.any_str.max_length"
    }
  ]
}
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | Вектор возвращён |
| 422 | Текст пустой или слишком длинный (> 8192 символов) |
| 503 | Модель недоступна |
| 504 | Timeout → Celery retry |

---

## 9. Сводная таблица эндпоинтов

| Метод | URL | Auth | Доступ | Пагинация |
|-------|-----|------|--------|-----------|
| POST | `/api/auth/token/` | — | anonymous | — |
| POST | `/api/register/` | — | anonymous | — |
| GET | `/api/me/` | Token | user | — |
| GET | `/api/users/` | Token | staff | ✅ `results` |
| GET | `/api/chats/` | Token | user | ✅ `results` |
| POST | `/api/chats/` | Token | user | — |
| GET | `/api/chats/{id}/` | Token | chat_member | — |
| PATCH | `/api/chats/{id}/` | Token | chat_owner / staff | — |
| PUT | `/api/chats/{id}/` | Token | chat_owner / staff | — |
| DELETE | `/api/chats/{id}/` | Token | chat_owner / staff | — |
| GET | `/api/chat-members/` | Token | chat_member | ✅ `results` |
| POST | `/api/chat-members/` | Token | chat_owner / staff | — |
| PATCH | `/api/chat-members/{id}/` | Token | chat_owner / staff | — |
| DELETE | `/api/chat-members/{id}/` | Token | chat_owner / staff | — |
| GET | `/api/messages/?chat=` | Token | chat_member | ✅ `results` |
| POST | `/api/messages/` | Token | chat_member | — |
| PATCH | `/api/messages/{id}/` | Token | автор / chat_owner / staff | — |
| DELETE | `/api/messages/{id}/` | Token | автор / chat_owner / staff | — |
| GET | `/api/search/?q=&chat_id=` | Token | chat_member | ✅ `results` |
| POST | `/api/assistant/` | Token | chat_member | — |
| WS | `/ws/chats/{id}/?token=` | Token | chat_member | — |
| POST | `ml:8001/classify` | API Key | internal (Celery) | — |
| POST | `ml:8001/embed` | API Key | internal (Celery) | — |

---


---

## Sprint backend update: current stabilized contracts

Current backend exposes live OpenAPI when `drf-spectacular` is installed:

- `GET /api/schema/`
- `GET /api/docs/`

All API errors are normalized to:

```json
{
  "detail": "Validation error.",
  "field_errors": {},
  "code": "invalid"
}
```

Message classification is asynchronous. `POST /api/messages/` returns after saving the message; `classification` can be `null` until `messages.tasks.classify_message_task` finishes. When present, classification includes `label`, `confidence`, `probabilities`, `status`, `error_message`, `source`, `needs_review`, `classified_at`.

Semantic search endpoint:

```http
GET /api/search/semantic/?q=...&chat=...&limit=20&date_from=2026-05-01&date_to=2026-05-25&message_type=task
```

Rules:

- regular users search only messages from chats where they are participants;
- project admins search all chats;
- messages without embeddings are skipped;
- `limit` is capped at 50.

Response item:

```json
{
  "message_id": 42,
  "chat_id": 10,
  "chat_title": "Sprint planning",
  "sender": {"id": 1, "username": "demo"},
  "text": "Prepare release notes",
  "message_type": "task",
  "created_at": "2026-05-25T10:00:00Z",
  "classification": "task",
  "similarity_score": 0.923
}
```
