import json
import math
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from django.db.models import Count
from rest_framework.test import APIRequestFactory, force_authenticate

from chats.models import Chat, ChatMember
from messages.models import Message, MessageClassification, MessageEmbedding
from messages.tasks import text_hash
from messages.views import SemanticSearchView
from users.models import User

NOW = datetime.now(timezone.utc)
ARTIFACT_DIR = Path.cwd() / 'artifacts'
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
stamp = NOW.strftime('%Y%m%d_%H%M%S')
json_path = ARTIFACT_DIR / f'semantic_search_metrics_{stamp}.json'
md_path = ARTIFACT_DIR / f'semantic_search_metrics_{stamp}.md'
TOP_K = (1, 3, 5)
MAX_SELF_EVAL = 100
MAX_TYPO_EVAL = 30
API_LIMIT = 10
factory = APIRequestFactory()
view = SemanticSearchView.as_view()

def normalize(value):
    return SemanticSearchView._normalize_search_text(value or '')

def cosine(left, right):
    if not left or not right:
        return 0.0
    numerator = sum(float(a) * float(b) for a, b in zip(left, right))
    left_norm = math.sqrt(sum(float(a) * float(a) for a in left)) or 1.0
    right_norm = math.sqrt(sum(float(b) * float(b) for b in right)) or 1.0
    return numerator / (left_norm * right_norm)

def rank_metrics(ranks, total):
    actual = [rank for rank in ranks if rank]
    result = {'evaluated': total}
    for k in TOP_K:
        result[f'hit_at_{k}'] = round(sum(1 for rank in actual if rank <= k) / total, 6) if total else 0.0
    result['mrr'] = round(sum(1 / rank for rank in actual) / total, 6) if total else 0.0
    result['mean_rank'] = round(statistics.mean(actual), 3) if actual else None
    result['median_rank'] = round(statistics.median(actual), 3) if actual else None
    result['misses'] = total - len(actual)
    return result

def endpoint_search(user, query, chat_id=None, limit=API_LIMIT):
    params = {'q': query, 'limit': limit}
    if chat_id:
        params['chat'] = chat_id
    request = factory.get('/api/search/semantic/', params)
    force_authenticate(request, user=user)
    started = time.perf_counter()
    response = view(request)
    return response.status_code, getattr(response, 'data', {}), (time.perf_counter() - started) * 1000

def typo_query(text):
    tokens = normalize(text).split()
    if not tokens:
        return None
    token = max(tokens, key=len)
    if len(token) < 5:
        return None
    index = max(1, len(token) // 2)
    typo = token[:index] + token[index + 1:]
    replaced = False
    result = []
    for item in tokens:
        if not replaced and item == token:
            result.append(typo)
            replaced = True
        else:
            result.append(item)
    query = ' '.join(result)
    return query if query != normalize(text) else None

messages_qs = Message.objects.select_related('chat', 'sender', 'classification')
non_empty_qs = messages_qs.exclude(text__isnull=True).exclude(text='')
embedding_qs = MessageEmbedding.objects.select_related('message', 'message__chat', 'message__sender')
message_count = messages_qs.count()
non_empty_count = non_empty_qs.count()
embedding_count = embedding_qs.count()
stale_count = sum(1 for emb in embedding_qs.iterator() if emb.text_hash != text_hash(emb.message.text))
largest_chat = Chat.objects.annotate(message_count=Count('messages')).filter(message_count__gt=0).order_by('-message_count').first()
member = ChatMember.objects.filter(chat=largest_chat).select_related('user').first() if largest_chat else None
user = member.user if member else User.objects.filter(is_active=True).first()
classification_distribution = dict(MessageClassification.objects.values_list('label').annotate(total=Count('id')).order_by('label'))

sample_embeddings = list(embedding_qs.filter(message__text__isnull=False).exclude(message__text='').order_by('-message__created_at')[:MAX_SELF_EVAL])
search_space = list(embedding_qs.filter(message__text__isnull=False).exclude(message__text='').order_by('-message__created_at')[:1000])
self_ranks = []
same_text_ranks = []
for emb in sample_embeddings:
    scored = sorted(((cosine(emb.vector, candidate.vector), candidate.message_id, normalize(candidate.message.text)) for candidate in search_space), key=lambda item: item[0], reverse=True)
    target_text = normalize(emb.message.text)
    self_ranks.append(next((idx for idx, (_, message_id, _) in enumerate(scored, 1) if message_id == emb.message_id), None))
    same_text_ranks.append(next((idx for idx, (_, _, text) in enumerate(scored, 1) if text == target_text), None))

latencies = []
typo_ranks = []
typo_samples = []
if user and largest_chat:
    for message in list(non_empty_qs.filter(chat=largest_chat).order_by('-created_at')[:MAX_TYPO_EVAL]):
        query = typo_query(message.text)
        if not query:
            continue
        status_code, data, elapsed_ms = endpoint_search(user, query, chat_id=largest_chat.id, limit=API_LIMIT)
        latencies.append(elapsed_ms)
        rows = data.get('results', []) if isinstance(data, dict) else []
        rank = next((idx for idx, row in enumerate(rows, 1) if row.get('message_id') == message.id), None)
        typo_ranks.append(rank)
        typo_samples.append({'query': query, 'expected_message_id': message.id, 'expected_text': message.text, 'rank': rank, 'top_result_id': rows[0].get('message_id') if rows else None, 'top_score': rows[0].get('similarity_score') if rows else None, 'top_mode': rows[0].get('search_mode') if rows else None, 'latency_ms': round(elapsed_ms, 3), 'status_code': status_code})

category_metrics = {}
if user and largest_chat:
    for label, query in {'question': 'вопросы', 'task': 'задачи', 'offtopic': 'токсичность'}.items():
        relevant_total = Message.objects.filter(chat=largest_chat, classification__label=label).count()
        status_code, data, elapsed_ms = endpoint_search(user, query, chat_id=largest_chat.id, limit=API_LIMIT)
        latencies.append(elapsed_ms)
        rows = data.get('results', []) if isinstance(data, dict) else []
        relevant_returned = sum(1 for row in rows if row.get('classification') == label)
        category_metrics[label] = {'query': query, 'relevant_total_in_chat': relevant_total, 'returned': len(rows), 'relevant_returned': relevant_returned, 'precision_at_10': round(relevant_returned / len(rows), 6) if rows else None, 'recall_at_10': round(relevant_returned / relevant_total, 6) if relevant_total else None, 'latency_ms': round(elapsed_ms, 3), 'status_code': status_code}

latency = {}
if latencies:
    values = sorted(latencies)
    latency = {'samples': len(values), 'avg_ms': round(statistics.mean(values), 3), 'median_ms': round(statistics.median(values), 3), 'p95_ms': round(values[min(len(values) - 1, math.ceil(len(values) * 0.95) - 1)], 3), 'max_ms': round(max(values), 3)}

report = {'generated_at': NOW.isoformat(), 'notes': ['Автоматический отчет по текущей локальной БД без ручной разметки релевантности.', 'Semantic self-retrieval проверяет ближайшего соседа по embedding-вектору самого сообщения.', 'Полноценные Precision@K/Recall@K/MRR/NDCG по смысловой релевантности требуют benchmark-набора с ручной разметкой.'], 'dataset_snapshot': {'messages_total': message_count, 'messages_with_text': non_empty_count, 'embeddings_total': embedding_count, 'embedding_coverage': round(embedding_count / non_empty_count, 6) if non_empty_count else 0.0, 'stale_embeddings_total': stale_count, 'stale_embedding_rate': round(stale_count / embedding_count, 6) if embedding_count else 0.0, 'largest_chat': {'id': largest_chat.id if largest_chat else None, 'title': largest_chat.title if largest_chat else None, 'message_count': largest_chat.message_count if largest_chat else None}, 'evaluation_user': user.username if user else None, 'classification_distribution': classification_distribution}, 'semantic_self_retrieval': {'exact_message_id': rank_metrics(self_ranks, len(sample_embeddings)), 'same_normalized_text': rank_metrics(same_text_ranks, len(sample_embeddings))}, 'typo_fuzzy_retrieval': {'metrics': rank_metrics(typo_ranks, len(typo_ranks)), 'samples': typo_samples[:10]}, 'category_search': category_metrics, 'latency': latency}
json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding='utf-8')

lines = ['# Semantic Search Metrics', '', f'Generated at: `{report["generated_at"]}`', '', '## Важно', '', '- Отчет рассчитан автоматически по текущей локальной БД.', '- Это технические sanity-check метрики, а не ручная оценка смысловой релевантности.', '- Для настоящих Precision@K/Recall@K/MRR/NDCG нужен размеченный benchmark запросов.', '', '## Snapshot', '', f'- Messages total: `{message_count}`', f'- Messages with text: `{non_empty_count}`', f'- Embeddings total: `{embedding_count}`', f'- Embedding coverage: `{report["dataset_snapshot"]["embedding_coverage"]:.2%}`', f'- Stale embeddings: `{stale_count}` (`{report["dataset_snapshot"]["stale_embedding_rate"]:.2%}`)', f'- Largest chat: `{largest_chat.title if largest_chat else "n/a"}` / id `{largest_chat.id if largest_chat else "n/a"}` / messages `{largest_chat.message_count if largest_chat else "n/a"}`', f'- Evaluation user: `{user.username if user else "n/a"}`', '', '## Semantic Self-Retrieval', '', '| Metric | Exact message id | Same normalized text |', '|---|---:|---:|']
for key in ['evaluated', 'hit_at_1', 'hit_at_3', 'hit_at_5', 'mrr', 'mean_rank', 'median_rank', 'misses']:
    lines.append(f'| {key} | `{report["semantic_self_retrieval"]["exact_message_id"].get(key)}` | `{report["semantic_self_retrieval"]["same_normalized_text"].get(key)}` |')
lines += ['', '## Typo/Fuzzy Retrieval', '', '| Metric | Value |', '|---|---:|']
for key, value in report['typo_fuzzy_retrieval']['metrics'].items():
    lines.append(f'| {key} | `{value}` |')
lines += ['', '## Category Search', '', '| Label | Query | Relevant total | Returned | Precision@10 | Recall@10 | Latency ms |', '|---|---|---:|---:|---:|---:|---:|']
for label, item in category_metrics.items():
    lines.append(f'| {label} | `{item["query"]}` | `{item["relevant_total_in_chat"]}` | `{item["returned"]}` | `{item["precision_at_10"]}` | `{item["recall_at_10"]}` | `{item["latency_ms"]}` |')
lines += ['', '## Latency', '', '| Metric | Value |', '|---|---:|']
for key, value in latency.items():
    lines.append(f'| {key} | `{value}` |')
lines += ['', '## Files', '', f'- JSON: `{json_path}`', f'- Markdown: `{md_path}`']
md_path.write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps({'json_path': str(json_path), 'md_path': str(md_path), 'dataset_snapshot': report['dataset_snapshot'], 'semantic_self_retrieval': report['semantic_self_retrieval'], 'typo_fuzzy_retrieval': report['typo_fuzzy_retrieval']['metrics'], 'category_search': report['category_search'], 'latency': report['latency']}, ensure_ascii=False, indent=2, default=str))
