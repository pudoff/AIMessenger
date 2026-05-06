# AI Chat — Проектирование модели системы (MVP)
## Обзор системы
Проект представляет собой интеллектуальный мессенджер с ML-функциями: классификацией сообщений, семантическим поиском и AI-ассистентом на основе RAG. Архитектура разделена на четыре слоя: Frontend (React), Backend (Django + DRF), ML Service (FastAPI), Database (PostgreSQL + pgvector), объединённых асинхронной очередью Celery + Redis и упакованных в Docker.

***
## 1. Технологический стек
| Компонент | Технология | Ответственность |
|---|---|---|
| **Frontend** | React | UI чата, кнопки AI-функций, страницы авторизации/ассистента/админки |
| **Backend** | Django + DRF | REST API, авторизация, управление чатами и сообщениями, ORM |
| **ML Service** | FastAPI | Отдельный сервис: `/classify`, `/embed`, LLM-генерация |
| **Celery** | Celery | Асинхронное выполнение ML-задач (классификация, эмбеддинг, RAG) |
| **Redis** | Redis 7+ | Брокер задач для Celery |
| **Database** | PostgreSQL 15 + pgvector | Хранение данных + векторный поиск по смыслу |

**Ключевое архитектурное решение**: Backend (Django) не блокируется тяжёлыми ML-вычислениями — он публикует задачу в Redis, возвращает ответ клиенту, а Celery Worker обрабатывает задачу асинхронно.

***
## 2. Архитектурная схема
![](architecture_white.png)
---
## 3. Модель данных
### 3.1 Сущности и атрибуты
#### `User` — Пользователь

| Атрибут | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | UUID | PK | Идентификатор |
| `username` | VARCHAR(64) | UNIQUE, NOT NULL | Логин |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email |
| `password_hash` | VARCHAR(255) | NOT NULL | Хэш пароля (bcrypt) |
| `is_active` | BOOLEAN | DEFAULT TRUE | Статус аккаунта |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата регистрации |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Дата обновления |

#### `Role` — Роль участника в чате

| Атрибут | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | SERIAL | PK | Идентификатор |
| `name` | VARCHAR(32) | UNIQUE, NOT NULL | `owner` / `admin` / `member` / `guest` |
| `description` | TEXT | | Описание прав |

#### `Chat` — Чат / комната

| Атрибут | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | UUID | PK | Идентификатор чата |
| `title` | VARCHAR(255) | NOT NULL | Название |
| `created_by` | UUID | FK → users.id | Создатель |
| `is_active` | BOOLEAN | DEFAULT TRUE | Активность |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата создания |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Дата обновления |

#### `ChatMember` — Участник чата

| Атрибут | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | SERIAL | PK | Идентификатор |
| `chat_id` | UUID | FK → chats.id | Чат |
| `user_id` | UUID | FK → users.id | Пользователь |
| `role_id` | INT | FK → roles.id | Роль в чате |
| `joined_at` | TIMESTAMP | DEFAULT NOW() | Дата вступления |

Составной уникальный ключ: `UNIQUE(chat_id, user_id)`.

#### `Message` — Сообщение

| Атрибут | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | UUID | PK | Идентификатор |
| `chat_id` | UUID | FK → chats.id | Чат |
| `sender_id` | UUID | FK → users.id, NULL | Отправитель (NULL для AI) |
| `content` | TEXT | NOT NULL | Текст сообщения |
| `message_type` | VARCHAR(16) | CHECK IN ('user','assistant','system') | Тип отправителя |
| `label` | VARCHAR(32) | NULLABLE | ML-метка: `question`/`task`/`offtopic`/`statement` |
| `parent_message_id` | UUID | FK → messages.id, NULL | Ответ на сообщение |
| `is_deleted` | BOOLEAN | DEFAULT FALSE | Мягкое удаление |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата создания |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Дата обновления |

> Поле `label` заполняется асинхронно через Celery после классификации сообщения ML-сервисом.

#### `Embedding` — Векторное представление

| Атрибут | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | UUID | PK | Идентификатор |
| `message_id` | UUID | FK → messages.id, UNIQUE | Связь (1:1) |
| `vector` | VECTOR(1536) | NOT NULL | Вектор (pgvector) |
| `model_name` | VARCHAR(64) | NOT NULL | Название модели |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата создания |
### 3.2 Связи между сущностями
```
User       (1) ──< (N) ChatMember  >── (N:1)  Chat
User       (1) ──< (N) Message
User       (1) ──< (N) Chat         [created_by]
Chat       (1) ──< (N) Message
Role       (1) ──< (N) ChatMember
Message    (1) ──< (N) Message      [parent_message_id — самосвязь]
Message    (1) ──  (1) Embedding
```

***
## 4. ER-диаграмма (PlantUML)
![](er_ai_chat.png)

***
## 5. Структура БД PostgreSQL
```sql
-- Расширения
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Роли
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(32) NOT NULL UNIQUE,
    description TEXT
);
INSERT INTO roles (name, description) VALUES
    ('owner',  'Создатель чата, все права'),
    ('admin',  'Управление участниками'),
    ('member', 'Отправка и чтение сообщений'),
    ('guest',  'Только чтение');

-- Пользователи
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(64)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Чаты
CREATE TABLE chats (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(255) NOT NULL,
    created_by UUID         REFERENCES users(id) ON DELETE SET NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Участники чата
CREATE TABLE chat_members (
    id        SERIAL    PRIMARY KEY,
    chat_id   UUID      NOT NULL REFERENCES chats(id)   ON DELETE CASCADE,
    user_id   UUID      NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role_id   INT       NOT NULL REFERENCES roles(id),
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (chat_id, user_id)
);

-- Сообщения
CREATE TABLE messages (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id           UUID        NOT NULL REFERENCES chats(id)    ON DELETE CASCADE,
    sender_id         UUID        REFERENCES users(id)             ON DELETE SET NULL,
    content           TEXT        NOT NULL,
    message_type      VARCHAR(16) NOT NULL DEFAULT 'user'
                        CHECK (message_type IN ('user', 'assistant', 'system')),
    label             VARCHAR(32) CHECK (label IN ('question', 'task', 'statement', 'offtopic')),
    parent_message_id UUID        REFERENCES messages(id)          ON DELETE SET NULL,
    is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Эмбеддинги (pgvector)
CREATE TABLE embeddings (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID         NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    vector     VECTOR(1536) NOT NULL,
    model_name VARCHAR(64)  NOT NULL DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
```
### Индексы
```sql
-- Поиск сообщений в чате
CREATE INDEX idx_messages_chat_id    ON messages(chat_id);
CREATE INDEX idx_messages_sender_id  ON messages(sender_id);
CREATE INDEX idx_messages_chat_time  ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_label      ON messages(label);       -- фильтрация по типу

-- Участники
CREATE INDEX idx_chat_members_user   ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat   ON chat_members(chat_id);

-- Векторный поиск — 
CREATE INDEX idx_embeddings_hnsw
    ON embeddings
    USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

***
## 6. Потоки данных
![](dataflows_white.png)

### 6.1 Отправка сообщения (синхронный + асинхронный поток)
```
[Видимый поток — синхронный]
1. Frontend  → POST /api/messages/ (content, chat_id)
2. Backend   → Валидация JWT + проверка членства в чате (chat_members)
3. Backend   → INSERT INTO messages (chat_id, sender_id, content)
4. Backend   ← 201 Created {message_id}
5. Backend   → WebSocket broadcast: {event: "new_message"}

[Скрытая магия ML — асинхронный поток]
6. Backend   → Redis: LPUSH task classify+embed(message_id)
7. Celery    ← consume task
8. Celery    → ML Service: POST /classify {text} → {label: "question"}
9. Celery   → ML Service: POST /embed {text} → {vector: [...1536]}
10. Celery   → UPDATE messages SET label=... WHERE id=message_id
11. Celery   → INSERT INTO embeddings (message_id, vector)
```

**Ключевое преимущество**: UI не блокируется тяжёлыми ML-вычислениями.
### 6.2 Семантический поиск
```
1. Frontend  → GET /api/search?q="текст"&chat_id={id}
2. Backend   → Redis: publish task search(query, chat_id)
3. Celery    ← consume task
4. Celery    → ML Service: POST /embed {text: query} → query_vector
5. Celery    → PostgreSQL:
               SELECT m.*, e.vector <=> query_vector AS dist
               FROM messages m JOIN embeddings e ON e.message_id = m.id
               WHERE m.chat_id = {id}
               ORDER BY dist ASC LIMIT 10;
6. Backend   ← 200 OK [{message, label, similarity_score}]
7. Frontend  → Отобразить релевантные сообщения с подсветкой label
```

Поиск происходит **по смыслу**, а не по ключевым словам — находит релевантные ответы даже без точного совпадения слов.
### 6.3 AI-ассистент (RAG)
```
1. Frontend  → POST /api/assistant/ {question: "Кто отвечает за дедлайн?"}
2. Backend   → Redis: publish task generate_response(question, chat_id)
3. Backend   ← 202 Accepted {task_id}

--- Celery Worker: RAG pipeline ---
4. Celery    → ML Service: POST /embed {text: question} → query_vector
5. Celery    → PostgreSQL pgvector: найти топ-5 релевантных сообщений
6. Celery    → Сформировать prompt:
               system: "Ты ассистент чата. Контекст: {relevant_messages}"
               user: {question}
7. Celery    → ML Service: LLM API → response
8. Celery    → INSERT INTO messages (message_type='assistant', content=response)
9. Celery    → INSERT INTO embeddings (embed AI-ответа)
10. Backend  → WebSocket push: {event: "ai_response", content: response}
11. Frontend ← Ответ: "Ответственный — Анна (на основе логов чата)"
```

***
## 7. API-спецификация
### Backend (Django + DRF)
| Метод | Эндпоинт | Описание |
|---|---|---|
| POST | `/api/auth/login/` | Авторизация, получение JWT |
| POST | `/api/auth/register/` | Регистрация пользователя |
| GET | `/api/chats/` | Список чатов пользователя |
| POST | `/api/chats/` | Создать чат |
| GET | `/api/chats/{id}/messages/` | История сообщений (пагинация) |
| POST | `/api/chats/{id}/messages/` | Отправить сообщение |
| GET | `/api/chats/{id}/members/` | Участники чата |
| POST | `/api/chats/{id}/members/` | Добавить участника |
| GET | `/api/search/` | Семантический поиск `?q=&chat_id=` |
| POST | `/api/assistant/` | Запрос к AI-ассистенту |
| WS | `/ws/chats/{id}/` | WebSocket: real-time события |
### ML Service (FastAPI)
| Метод | Эндпоинт | Вход | Выход |
|---|---|---|---|
| POST | `/classify` | `{text: str}` | `{label: "question"\|"task"\|"statement"\|"offtopic"}` |
| POST | `/embed` | `{text: str}` | `{vector: float, model: str}` |

На этапе MVP эндпоинты возвращают **mock-данные** — реальные модели подключаются на следующем этапе.

***
## 8. Метрики качества ML
| ML-задача | Метрики | Описание |
|---|---|---|
| **Классификация сообщений** | Accuracy, F1-score | Точность определения типа (вопрос/задача/оффтоп) |
| **Семантический поиск** | Precision, Recall | Релевантность найденных сообщений |
| **AI-ассистент (RAG)** | Human Eval (эксперт) | Оценка 4.5/5, контроль галлюцинаций |


***
## 9. Вектор развития (Масштабирование)
| Этап | Архитектура | Описание |
|---|---|---|
| **MVP (текущий)** | Django — монолит с Celery | Быстрый запуск, командная разработка |
| **Будущее** | Микросервисы на FastAPI | Выделение ML-ветки для независимого масштабирования |
| **Expansion** | Нативные приложения | Android и iOS — за рамками учебного проекта |

MVP Scope (что делаем сейчас):
- Веб-приложение React + Backend Django
- PostgreSQL с pgvector
- Базовая классификация сообщений и семантический поиск
- AI-ассистент (RAG)

Вне рамок проекта: голосовой ввод/вывод, интеграция с CRM, загрузка и анализ файлов, нативные мобильные приложения.


