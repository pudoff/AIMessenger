# ML-service: классификация сообщений

`ml-service` отвечает за базовую классификацию сообщений чата. Текущая модель использует TF-IDF по символьным n-граммам и логистическую регрессию. Это легкий baseline для MVP: он быстро обучается, не требует GPU и возвращает вероятности по классам.

## Таксономия

Канонические классы ML:

- `question` — вопрос.
- `task` — поручение или задача.
- `statement` — обычное сообщение, ответ, нейтральное утверждение.
- `offtopic` — токсичное, нерелевантное или требующее отдельной модерации сообщение.

Для совместимости старые классы мапятся так:

- `answer` -> `statement`.
- `default` -> `statement`.
- `toxic` -> `offtopic`.

Если уверенность модели ниже порога, `predict_one()` возвращает `needs_review`, чтобы backend не присваивал сомнительный тег автоматически.

## Структура

- `train_classifier.py` — основной скрипт обучения и аудита датасета.
- `predictor.py` — runtime-обертка для backend/Celery.
- `tasks.py` — Celery tasks `ml_service.classify_message` и `ml_service.classify_messages`.
- `artifacts/chat_dataset.csv` — рабочий датасет.
- `artifacts/chat_classifier_final.pkl` — сохраненная модель.
- `artifacts/training_metrics.json` — метрики обучения.
- `artifacts/confusion_matrix.csv` — матрица ошибок.
- `artifacts/dataset_quality_report.json` — отчет по качеству датасета.
- `tests/test_predictor.py` — smoke-тесты predictor.

## Обучение

Из каталога `4_Sources/ml-service`:

```powershell
.\.venv\Scripts\python train_classifier.py
```

Быстрый запуск без GridSearchCV:

```powershell
.\.venv\Scripts\python train_classifier.py --no-grid
```

Только отчет по датасету без обучения:

```powershell
.\.venv\Scripts\python train_classifier.py --report-only
```

Скрипт сохраняет:

- `best_params` из `GridSearchCV`.
- `best_cv_score`.
- `test_accuracy`, `macro_f1`, `weighted_f1`.
- метрики по каждому классу.
- дату обучения, версию датасета, размер датасета и `random_seed`.

## Проверка качества датасета

Текущая проблема старого датасета: в корневом `chat_dataset.csv` было 1 000 000 строк и 705 101 exact-дубликат текста. Из-за этого метрики `accuracy = 1.0` и `f1-score = 1.0` выглядят подозрительно и не должны считаться доказательством качества модели.

Рабочим источником выбран `artifacts/chat_dataset.csv`: 294 899 строк, exact-дубликатов текста не обнаружено. Отчет сохраняется в `artifacts/dataset_quality_report.json`.

## Prediction API

```python
from predictor import ChatPredictor

predictor = ChatPredictor(confidence_threshold=0.55)
result = predictor.predict_one("Кто отвечает за API?")
```

Формат ответа:

```json
{
  "label": "question",
  "class_name": "question",
  "confidence": 0.91,
  "max_probability": 0.91,
  "probabilities": {
    "question": 0.91,
    "statement": 0.03,
    "task": 0.05,
    "offtopic": 0.01
  },
  "needs_review": false
}
```

При низкой уверенности:

```json
{
  "label": "needs_review",
  "class_name": "needs_review",
  "confidence": 0.42,
  "needs_review": true,
  "review_reason": "low_confidence"
}
```

## Тесты

```powershell
.\.venv\Scripts\python -m unittest discover -s tests
```

Важно: текущий `chat_classifier_final.pkl` сохранен в `scikit-learn 1.8.0`, поэтому окружение ML-service должно использовать `scikit-learn>=1.8,<1.9`.

## Интеграция с backend

Текущий MVP-сценарий:

1. Frontend отправляет сообщение в backend.
2. Backend создает `Message`.
3. Backend вызывает `messages.classification.classify_text()`.
4. `classify_text()` загружает `ml-service/predictor.py` и вызывает `predict_one()`.
5. Backend сохраняет результат в `MessageClassification`.
6. API возвращает `classification` вместе с сообщением.
7. Frontend отображает тег сообщения.

Целевой production-сценарий:

1. Backend создает `Message`.
2. Backend ставит Celery task `ml_service.classify_message`.
3. ML-worker возвращает классификацию.
4. Backend обновляет `MessageClassification`.
5. Frontend получает обновленный тег через polling или websocket.

## Sprint update: embeddings

`ml-service` also exposes Celery embedding tasks:

- `ml_service.embed_text(text)`
- `ml_service.embed_texts(texts)`

The default multilingual model is `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, suitable for Russian and English MVP semantic search. The response contract:

```json
{
  "embedding": [0.01, 0.02],
  "model_name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "dimensions": 384
}
```

Empty or one-character texts raise validation errors. If `sentence-transformers` is unavailable in a local dev environment, `embedder.py` falls back to a deterministic 384-dimensional hash embedding so backend smoke-tests can still run without GPU or model downloads.

Smoke tests:

```powershell
python -m pytest tests
```
