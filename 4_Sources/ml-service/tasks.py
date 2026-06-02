from typing import Any

from celery_app import app
from embedder import TextEmbedder
from predictor import ChatPredictor


predictor = None
embedder = None


def get_predictor():
    global predictor
    if predictor is None:
        predictor = ChatPredictor()
    return predictor


def get_embedder():
    global embedder
    if embedder is None:
        embedder = TextEmbedder()
    return embedder


@app.task(name="ml_service.classify_message")
def classify_message(message: str) -> dict:
    return get_predictor().predict_one(message)


@app.task(name="ml_service.classify_messages")
def classify_messages(messages: list[str]) -> list[Any]:
    return get_predictor().predict_batch(messages)


@app.task(name="ml_service.embed_text")
def embed_text(text: str) -> dict:
    return get_embedder().embed_one(text)


@app.task(name="ml_service.embed_texts")
def embed_texts(texts: list[str]) -> list[dict]:
    return get_embedder().embed_batch(texts)
