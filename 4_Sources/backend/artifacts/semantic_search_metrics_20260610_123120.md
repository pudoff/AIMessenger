# Semantic Search Metrics

Generated at: `2026-06-10T12:31:20.603588+00:00`

## Важно

- Отчет рассчитан автоматически по текущей локальной БД.
- Это технические sanity-check метрики, а не ручная оценка смысловой релевантности.
- Для настоящих Precision@K/Recall@K/MRR/NDCG нужен размеченный benchmark запросов.

## Snapshot

- Messages total: `34`
- Messages with text: `34`
- Embeddings total: `34`
- Embedding coverage: `100.00%`
- Stale embeddings: `0` (`0.00%`)
- Largest chat: `Direct chat 8-6` / id `1` / messages `34`
- Evaluation user: `alex_pudoff`

## Semantic Self-Retrieval

| Metric | Exact message id | Same normalized text |
|---|---:|---:|
| evaluated | `34` | `34` |
| hit_at_1 | `1.0` | `1.0` |
| hit_at_3 | `1.0` | `1.0` |
| hit_at_5 | `1.0` | `1.0` |
| mrr | `1.0` | `1.0` |
| mean_rank | `1` | `1` |
| median_rank | `1.0` | `1.0` |
| misses | `0` | `0` |

## Typo/Fuzzy Retrieval

| Metric | Value |
|---|---:|
| evaluated | `27` |
| hit_at_1 | `0.962963` |
| hit_at_3 | `1.0` |
| hit_at_5 | `1.0` |
| mrr | `0.981481` |
| mean_rank | `1.037` |
| median_rank | `1` |
| misses | `0` |

## Category Search

| Label | Query | Relevant total | Returned | Precision@10 | Recall@10 | Latency ms |
|---|---|---:|---:|---:|---:|---:|
| question | `вопросы` | `11` | `10` | `1.0` | `0.909091` | `21.643` |
| task | `задачи` | `10` | `10` | `1.0` | `1.0` | `16.314` |
| offtopic | `токсичность` | `2` | `2` | `1.0` | `1.0` | `10.036` |

## Latency

| Metric | Value |
|---|---:|
| samples | `30` |
| avg_ms | `100.829` |
| median_ms | `96.747` |
| p95_ms | `192.843` |
| max_ms | `201.235` |

## Files

- JSON: `D:\Pudov\УРФУ\03.Учеба\2. Семестр\Проектный практикум\Repo\AIMessenger\AIMessenger\4_Sources\backend\artifacts\semantic_search_metrics_20260610_123120.json`
- Markdown: `D:\Pudov\УРФУ\03.Учеба\2. Семестр\Проектный практикум\Repo\AIMessenger\AIMessenger\4_Sources\backend\artifacts\semantic_search_metrics_20260610_123120.md`