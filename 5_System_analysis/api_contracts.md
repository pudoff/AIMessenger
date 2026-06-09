# API Контракты — AI Messenger (MVP)

## Общие правила

API использует **DRF Token Authentication**. Во всех защищённых запросах frontend передаёт заголовок:

```http
Authorization: Token <token>
```

Если токен отсутствует или невалиден, backend возвращает `401 Unauthorized`. Если у пользователя нет прав, возвращается `403 Forbidden`. Если объект не найден или скрыт по правам доступа, возвращается `404 Not Found`.

---

## Глобальный формат ошибок

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

### Объект не найден — 404

```json
{
  "detail": "No Chat matches the given query."
}
```

### Ошибки валидации — 400

```json
{
  "username": ["A user with that username already exists."],
  "email": ["Enter a valid email address."],
  "non_field_errors": ["Unable to log in with provided credentials."]
}
```

`non_field_errors` используются для ошибок, не связанных с конкретным полем, например неверная пара login/password.

### Серверная ошибка — 500

```json
{
  "detail": "Internal Server Error."
}
```

---

## Таблица ролей

| Роль | Описание |
|---|---|
| `anonymous` | Не авторизован. Доступны только публичные эндпоинты. |
| `user` | Аутентифицированный пользователь. Видит только свои данные и чаты. |
| `chat_member` | Участник конкретного чата. |
| `chat_owner` | Участник с ролью `owner` или `admin` в конкретном чате. |
| `staff` | Django staff / superuser. Полный доступ. |

---

## 1. Аутентификация и пользователи

### `POST /api/auth/token/` — Получить токен

**Auth:** не требуется  
**Доступ:** `anonymous`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `username` | string | да | Логин пользователя |
| `password` | string | да | Пароль |

```json
{
  "username": "demo",
  "password": "StrongPassword123"
}
```

#### Response 200 OK

```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
}
```

После успешного ответа frontend сохраняет токен и отправляет его во всех защищённых запросах.

#### Response 400 Bad Request

```json
{
  "non_field_errors": [
    "Unable to log in with provided credentials."
  ]
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Токен выдан |
| 400 | Неверные username / password |

---

### `POST /api/auth/register/` — Регистрация

**Auth:** не требуется  
**Доступ:** `anonymous`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `username` | string | да | Уникальный логин |
| `password` | string | да | Пароль, минимум 8 символов |
| `email` | string | да | Уникальный email |
| `first_name` | string | да | Имя |
| `last_name` | string | да | Фамилия |
| `birth_date` | string (YYYY-MM-DD) | да | Дата рождения |
| `phone_number` | string | да | Уникальный номер |
| `accepted_user_agreement` | boolean | да | Должно быть `true` |
| `accepted_privacy_policy` | boolean | да | Должно быть `true` |

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

#### Response 201 Created

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

#### Response 400 Bad Request

```json
{
  "username": ["A user with that username already exists."],
  "email": ["user with this email already exists."],
  "phone_number": ["user with this phone number already exists."],
  "password": ["This password is too short. It must contain at least 8 characters."],
  "accepted_user_agreement": ["You must accept the user agreement."]
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 201 | Пользователь создан |
| 400 | Ошибки валидации |

---

### `GET /api/me/` — Текущий пользователь

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

#### Response 200 OK

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

`role` для обычного пользователя равен `user`, для Django staff/superuser — `admin`.

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Данные пользователя |
| 401 | Токен не передан или невалиден |

---

### `POST /api/auth/logout/` — Выход

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

#### Назначение

Удаляет токен пользователя на backend и завершает сессию авторизации на frontend.

#### Response 204 No Content

Тело ответа отсутствует.

#### Коды ответов

| Код | Ситуация |
|---|---|
| 204 | Пользователь вышел |
| 401 | Токен не передан или невалиден |

---

### `POST /api/auth/password-reset/` — Запрос восстановления пароля

**Auth:** не требуется  
**Доступ:** `anonymous`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `email` | string | да | Email пользователя |

```json
{
  "email": "demo@example.com"
}
```

#### Response 202 Accepted

```json
{
  "detail": "Password reset email sent."
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 202 | Письмо отправлено |
| 400 | Некорректный email |

---

### `POST /api/auth/password-reset/confirm/` — Подтверждение восстановления пароля

**Auth:** не требуется  
**Доступ:** `anonymous`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `uid` | string | да | Идентификатор пользователя из письма |
| `token` | string | да | Токен подтверждения |
| `new_password` | string | да | Новый пароль |

```json
{
  "uid": "MQ",
  "token": "set-password-token",
  "new_password": "NewStrongPassword123"
}
```

#### Response 200 OK

```json
{
  "detail": "Password has been reset successfully."
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Пароль обновлён |
| 400 | Ошибка token / uid / password |

---

### `POST /api/auth/email-confirm/` — Подтверждение email

**Auth:** не требуется  
**Доступ:** `anonymous`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `uid` | string | да | Идентификатор пользователя |
| `token` | string | да | Токен подтверждения email |

#### Response 200 OK

```json
{
  "detail": "Email confirmed successfully."
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Email подтверждён |
| 400 | Ошибка token / uid |

---

### `DELETE /api/me/` — Удаление аккаунта

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

#### Назначение

Удаляет аккаунт текущего пользователя или переводит его в неактивное состояние согласно backend-логике.

#### Response 204 No Content

#### Коды ответов

| Код | Ситуация |
|---|---|
| 204 | Аккаунт удалён |
| 401 | Не авторизован |
| 400 | Ошибка бизнес-логики |

---

### `GET /api/users/` — Список пользователей

**Auth:** `Authorization: Token <token>`  
**Доступ:** `staff`

#### Query parameters

| Параметр | Тип | Описание |
|---|---|---|
| `page` | integer | Номер страницы |

#### Response 200 OK

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

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Список пользователей |
| 401 | Не авторизован |
| 403 | Нет прав staff |

---

## 2. Чаты

### `GET /api/chats/` — Список своих чатов

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

#### Query parameters

| Параметр | Тип | Описание |
|---|---|---|
| `page` | integer | Номер страницы |
| `search` | string | Фильтр по названию |
| `ordering` | string | Сортировка, например `created_at` или `-updated_at` |

#### Response 200 OK

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
    }
  ]
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Список чатов |
| 401 | Не авторизован |

---

### `POST /api/chats/` — Создать чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `title` | string | да | Название чата |

```json
{
  "title": "Project Alpha"
}
```

#### Response 201 Created

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

Создатель автоматически получает роль `owner` в `chat_members`.

#### Response 400 Bad Request

```json
{
  "title": ["This field may not be blank."]
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 201 | Чат создан |
| 400 | Ошибки валидации |
| 401 | Не авторизован |

---

### `GET /api/chats/{id}/` — Получить чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

#### Response 200 OK

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

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Данные чата |
| 401 | Не авторизован |
| 404 | Чат не найден или пользователь не является участником |

---

### `PATCH /api/chats/{id}/` — Изменить чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

#### Request body

```json
{
  "title": "Project Alpha — Final"
}
```

#### Response 200 OK

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

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Чат обновлён |
| 400 | Ошибки валидации |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Чат не найден |

---

### `DELETE /api/chats/{id}/` — Удалить чат

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

#### Response 204 No Content

#### Коды ответов

| Код | Ситуация |
|---|---|
| 204 | Чат удалён |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Чат не найден |

---

## 3. Участники чата

### `GET /api/chat-members/` — Список участников

**Auth:** `Authorization: Token <token>`  
**Доступ:** `user`

#### Query parameters

| Параметр | Тип | Описание |
|---|---|---|
| `chat` | integer | ID чата |
| `page` | integer | Номер страницы |

#### Response 200 OK

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
    }
  ]
}
```

---

### `POST /api/chat-members/` — Добавить участника

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_owner` или `staff`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `chat` | integer | да | ID чата |
| `user` | integer | да | ID пользователя |
| `role` | string | да | `owner` / `admin` / `member` |

```json
{
  "chat": 1,
  "user": 2,
  "role": "member"
}
```

#### Response 201 Created

```json
{
  "id": 3,
  "chat": 1,
  "user": 2,
  "role": "member",
  "joined_at": "2026-05-18T12:30:00Z"
}
```

#### Response 400 Bad Request

```json
{
  "non_field_errors": [
    "The fields chat, user must make a unique set."
  ]
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 201 | Участник добавлен |
| 400 | Ошибки валидации / пользователь уже в чате |
| 401 | Не авторизован |
| 403 | Нет прав |
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

#### Response 200 OK

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

#### Response 204 No Content

---

## 4. Сообщения

> URL для сообщений: `/api/messages/?chat=<id>`.

### `GET /api/messages/` — Список сообщений

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

#### Query parameters

| Параметр | Тип | Обязательно | Описание |
|---|---|---:|---|
| `chat` | integer | да | ID чата |
| `page` | integer | нет | Номер страницы |
| `ordering` | string | нет | Сортировка, например `created_at` или `-created_at` |

#### Response 200 OK

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
      "classification": null,
      "created_at": "2026-05-18T10:00:00Z",
      "updated_at": "2026-05-18T10:00:00Z"
    }
  ]
}
```

`classification` может быть `null`, пока Celery не завершил обработку.

---

### `POST /api/messages/` — Отправить сообщение

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `chat` | integer | да | ID чата |
| `text` | string | да | Текст сообщения |
| `message_type` | string | нет | `default`, `question`, `task` |
| `task_status` | string | нет | `none`, `todo`, `in_progress`, `done` |
| `analyst_notes` | string | нет | Заметки аналитика |

`sender` не передаётся в request — backend подставляет `request.user`.

#### Response 201 Created

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
  "classification": null,
  "created_at": "2026-05-18T15:00:00Z",
  "updated_at": "2026-05-18T15:00:00Z"
}
```

#### Response 400 Bad Request

```json
{
  "task_status": [
    "Статус задачи можно указывать только для сообщений типа task."
  ]
}
```

#### Response 400 Bad Request

```json
{
  "chat": [
    "Invalid pk \"99\" - object does not exist."
  ]
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 201 | Сообщение создано |
| 400 | Ошибки валидации |
| 401 | Не авторизован |
| 403 | Не участник чата |

---

### `PATCH /api/messages/{id}/` — Изменить сообщение

**Auth:** `Authorization: Token <token>`  
**Доступ:** автор сообщения, `chat_owner` или `staff`

```json
{
  "text": "Сделать экран логина (обновлено)",
  "task_status": "in_progress"
}
```

#### Response 200 OK

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
  "classification": null,
  "created_at": "2026-05-18T15:00:00Z",
  "updated_at": "2026-05-18T15:30:00Z"
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Обновлено |
| 400 | Ошибки валидации |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Сообщение не найдено |

---

### `DELETE /api/messages/{id}/` — Удалить сообщение

**Auth:** `Authorization: Token <token>`  
**Доступ:** автор сообщения, `chat_owner` или `staff`

#### Response 204 No Content

---

## 5. Классификация сообщений

### `POST /api/messages/{id}/classify/` — Запустить классификацию

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

#### Назначение

Запускает асинхронную ML-обработку сообщения через Celery. Backend возвращает задачу в очередь, а результат сохраняется позже в поле `classification`.

#### Response 202 Accepted

```json
{
  "task_id": "d3b07384-d9a2-4e5c-8d3c-1a2b3c4d5e6f",
  "status": "queued"
}
```

#### Коды ответов

| Код | Ситуация |
|---|---|
| 202 | Классификация поставлена в очередь |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Сообщение не найдено |

---

## 6. Семантический поиск

### `GET /api/search/semantic/` — Семантический поиск по сообщениям

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

#### Query parameters

| Параметр | Тип | Обязательно | Описание |
|---|---|---:|---|
| `q` | string | да | Поисковый запрос |
| `chat` | integer | да | ID чата |
| `page` | integer | нет | Номер страницы |
| `limit` | integer | нет | Размер выдачи, максимум 50 |
| `date_from` | string | нет | Фильтр по дате начала |
| `date_to` | string | нет | Фильтр по дате конца |
| `message_type` | string | нет | Фильтр по типу сообщения |

#### Response 200 OK

```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "message_id": 42,
      "chat_id": 10,
      "chat_title": "Sprint planning",
      "sender": {
        "id": 1,
        "username": "demo"
      },
      "text": "Prepare release notes",
      "message_type": "task",
      "created_at": "2026-05-25T10:00:00Z",
      "classification": "task",
      "similarity_score": 0.923
    }
  ]
}
```

#### Правила

- обычные пользователи ищут только в чатах, где они участники;
- проектные админы могут искать по всем чатам;
- сообщения без embedding пропускаются;
- `limit` ограничен значением 50.

#### Коды ответов

| Код | Ситуация |
|---|---|
| 200 | Результаты поиска |
| 400 | Не передан `q` или `chat` |
| 401 | Не авторизован |
| 403 | Нет прав |

---

## 7. AI-ассистент

### `POST /api/assistant/` — Запрос к AI-ассистенту

**Auth:** `Authorization: Token <token>`  
**Доступ:** `chat_member`

#### Request body

| Поле | Тип | Обязательно | Описание |
|---|---|---:|---|
| `question` | string | да | Вопрос пользователя |
| `chat_id` | integer | да | ID чата, который используется как контекст |

```json
{
  "question": "Кто отвечает за задачу по логину?",
  "chat_id": 1
}
```

#### Response 202 Accepted

```json
{
  "task_id": "d3b07384-d9a2-4e5c-8d3c-1a2b3c4d5e6f",
  "status": "queued",
  "message": "Ответ будет доставлен через WebSocket."
}
```

Ответ AI приходит асинхронно через событие `ai_response`.

#### Коды ответов

| Код | Ситуация |
|---|---|
| 202 | Задача принята в Celery |
| 400 | Не передан `question` или `chat_id` |
| 401 | Не авторизован |
| 403 | Нет прав |
| 500 | Redis или Celery недоступны |

---

## 8. WebSocket — `/ws/chats/{id}/`

**Auth:** токен передаётся в query string:

```text
/ws/chats/1/?token=<token>
```

**Доступ:** `chat_member`

### Формат сообщений

Все события используют единую обёртку:

```json
{
  "event": "<event_type>",
  "payload": { }
}
```

### `new_message`

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

### `message_updated`

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

### `message_deleted`

```json
{
  "event": "message_deleted",
  "payload": {
    "id": 42
  }
}
```

### `ai_response`

```json
{
  "event": "ai_response",
  "payload": {
    "task_id": "d3b07384-d9a2-4e5c-8d3c-1a2b3c4d5e6f",
    "message_id": 99,
    "content": "Ответственный за задачу по логину — Анна.",
    "message_type": "assistant",
    "created_at": "2026-05-18T15:02:30Z"
  }
}
```

### `classification_updated`

```json
{
  "event": "classification_updated",
  "payload": {
    "message_id": 42,
    "classification": "question"
  }
}
```

### `error`

```json
{
  "event": "error",
  "payload": {
    "code": "permission_denied",
    "message": "You are not a member of this chat."
  }
}
```

### `ping` / `pong`

```json
{
  "event": "ping"
}
```

```json
{
  "event": "pong"
}
```

---

## 9. Интеграция ML через Celery

Отдельный ML microservice не используется. ML-задачи выполняются в фоне через Celery.

### Celery-задачи

- `classify_message`
- `generate_embedding`
- `generate_ai_response`
- `search_messages`

### Вход для ML-задач

Backend передаёт в Celery:
- `message_id`;
- `chat_id`;
- `text`;
- `user_id`;
- контекст выбранного чата;
- список сообщений для RAG, если нужен AI-ассистент.

### Выход ML-задач

Celery получает:
- `label`;
- `confidence`;
- `probabilities`;
- `vector`;
- `similarity_score`;
- сгенерированный ответ AI;
- статус выполнения и возможную ошибку.

### Сохранение результата

Backend или Celery сохраняет:
- `classification` в сообщение;
- `embedding` в таблицу `embeddings`;
- AI-ответ как отдельное сообщение типа `assistant`.

---

## 10. Fallback-сценарии

### ML недоступен

Если Celery или ML-обработка недоступны:
- сообщение всё равно сохраняется;
- `classification = null`;
- UI показывает, что классификация будет выполнена позже.

### Низкая confidence

Если confidence ниже порога:
- метка не сохраняется;
- `classification = null` или `needs_review = true`.

### Ошибка классификации

Если классификация завершилась ошибкой:
- backend не ломает отправку сообщения;
- задача помечается как failed;
- пользователь видит обычное сообщение без ML-тега.

### Пустое сообщение

Если `text` пустой:
- backend возвращает `400 Bad Request`;
- задача в Celery не создаётся.

---

## 11. Пагинация, фильтрация, сортировка

### Пагинация

Для списков используется стандартный DRF-формат:

```json
{
  "count": 100,
  "next": "http://127.0.0.1:8000/api/messages/?page=2",
  "previous": null,
  "results": []
}
```

### Фильтрация

Поддерживаются фильтры:
- `search` для чатов;
- `chat` для сообщений и участников;
- `q` для семантического поиска;
- `date_from` и `date_to` для поиска;
- `message_type` для поиска.

### Сортировка

Поддерживаются поля:
- `created_at`;
- `updated_at`;
- `-created_at`;
- `-updated_at`.

---

## 12. CORS и окружение

### Frontend dev URL

```text
http://127.0.0.1:3000
```

### Backend dev URL

```text
http://127.0.0.1:8000
```

### WebSocket dev URL

```text
ws://127.0.0.1:8000/ws/chats/{id}/?token=<token>
```

### CORS

Frontend должен иметь доступ к backend API из dev-окружения. Разрешаются запросы только с доверенных локальных адресов.

### Переменные окружения

Примерно должны быть заданы:

```env
DEBUG=True
SECRET_KEY=change-me
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000
API_PAGE_SIZE=20
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql://...
```

---

## 13. Сводная таблица эндпоинтов

| Метод | URL | Auth | Доступ | Пагинация |
|---|---|---|---|---|
| POST | `/api/auth/token/` | нет | anonymous | нет |
| POST | `/api/auth/register/` | нет | anonymous | нет |
| GET | `/api/me/` | Token | user | нет |
| POST | `/api/auth/logout/` | Token | user | нет |
| POST | `/api/auth/password-reset/` | нет | anonymous | нет |
| POST | `/api/auth/password-reset/confirm/` | нет | anonymous | нет |
| POST | `/api/auth/email-confirm/` | нет | anonymous | нет |
| DELETE | `/api/me/` | Token | user | нет |
| GET | `/api/users/` | Token | staff | да |
| GET | `/api/chats/` | Token | user | да |
| POST | `/api/chats/` | Token | user | нет |
| GET | `/api/chats/{id}/` | Token | chat_member | нет |
| PATCH | `/api/chats/{id}/` | Token | chat_owner / staff | нет |
| DELETE | `/api/chats/{id}/` | Token | chat_owner / staff | нет |
| GET | `/api/chat-members/` | Token | user | да |
| POST | `/api/chat-members/` | Token | chat_owner / staff | нет |
| PATCH | `/api/chat-members/{id}/` | Token | chat_owner / staff | нет |
| DELETE | `/api/chat-members/{id}/` | Token | chat_owner / staff | нет |
| GET | `/api/messages/?chat=` | Token | chat_member | да |
| POST | `/api/messages/` | Token | chat_member | нет |
| PATCH | `/api/messages/{id}/` | Token | author / chat_owner / staff | нет |
| DELETE | `/api/messages/{id}/` | Token | author / chat_owner / staff | нет |
| POST | `/api/messages/{id}/classify/` | Token | chat_member | нет |
| GET | `/api/search/semantic/` | Token | chat_member | да |
| POST | `/api/assistant/` | Token | chat_member | нет |
| WS | `/ws/chats/{id}/?token=` | Token | chat_member | нет |

---

## 14. Матрица соответствия

| Бизнес-требование | API | Backend модель | Frontend экран | Статус |
|---|---|---|---|---|
| Регистрация пользователя | `/api/auth/register/` | `User` | Экран регистрации | Готово |
| Логин | `/api/auth/token/` | `User` | Экран входа | Готово |
| Просмотр профиля | `/api/me/` | `User` | Профиль | Готово |
| Выход из системы | `/api/auth/logout/` | `User` | Профиль / меню | Добавить |
| Подтверждение email | `/api/auth/email-confirm/` | `User` | Экран подтверждения | Добавить |
| Восстановление пароля | `/api/auth/password-reset/` | `User` | Экран reset password | Добавить |
| Создание чата | `/api/chats/` | `Chat`, `ChatMember` | Список чатов / модалка | Готово |
| Просмотр сообщений | `/api/messages/?chat=` | `Message` | Экран чата | Готово |
| Добавление участника | `/api/chat-members/` | `ChatMember`, `Role` | Настройки чата | Готово |
| Классификация сообщения | `/api/messages/{id}/classify/` | `MessageClassification` | Тег у сообщения | В работе |
| Семантический поиск | `/api/search/semantic/` | `Embedding`, `Message` | Экран поиска | В работе |
| AI-ассистент | `/api/assistant/` | `Message`, `Embedding` | Панель AI | В работе |
| Real-time обновления | `/ws/chats/{id}/` | `Message`, `MessageClassification` | Экран чата | Частично |
| Удаление аккаунта | `DELETE /api/me/` | `User` | Профиль | Добавить |
| Fallback при недоступности ML | Celery retry / `classification = null` | `MessageClassification` | Экран чата | Готово |

---
