from typing import Any

from celery_app import app
from predictor import ChatPredictor


predictor = None


def get_predictor():
    global predictor
    if predictor is None:
        predictor = ChatPredictor()
    return predictor


@app.task(name="ml_service.classify_message")
def classify_message(message: str) -> dict:
    return get_predictor().predict_one(message)


@app.task(name="ml_service.classify_messages")
def classify_messages(messages: list[str]) -> list[Any]:
    return get_predictor().predict_batch(messages)
