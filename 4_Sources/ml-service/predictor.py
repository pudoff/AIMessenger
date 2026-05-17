from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = BASE_DIR / "artifacts" / "chat_classifier_final.pkl"
CANONICAL_CLASSES = ("question", "statement", "task", "offtopic")
CLASS_ALIASES = {
    "question": "question",
    "answer": "statement",
    "statement": "statement",
    "default": "statement",
    "task": "task",
    "toxic": "offtopic",
    "offtopic": "offtopic",
}
LEGACY_LABELS = {
    0: "question",
    1: "statement",
    2: "task",
    3: "offtopic",
}


class ChatPredictor:
    def __init__(
        self,
        model_path: str | Path | None = None,
        confidence_threshold: float = 0.55,
        min_message_length: int = 3,
    ) -> None:
        self.model_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
        self.confidence_threshold = confidence_threshold
        self.min_message_length = min_message_length
        self.model = joblib.load(self.model_path)
        self._patch_loaded_model()

    def predict_one(self, message: str) -> dict[str, Any]:
        text = self._clean_message(message)
        if len(text) < self.min_message_length:
            return self._needs_review(text, confidence=0.0, reason="too_short")

        raw_prediction = self.model.predict([text])[0]
        probabilities = self._predict_probabilities(text)
        predicted_class = self._to_class_name(raw_prediction)
        confidence = float(probabilities.get(predicted_class, 0.0))

        if confidence < self.confidence_threshold:
            result = self._needs_review(text, confidence=confidence, reason="low_confidence")
            result["raw_class_name"] = predicted_class
            return result

        return {
            "label": predicted_class,
            "class_name": predicted_class,
            "confidence": confidence,
            "max_probability": confidence,
            "probabilities": probabilities,
            "needs_review": False,
            "message": text,
        }

    def predict_batch(self, messages: list[str]) -> list[dict[str, Any]]:
        return [self.predict_one(message) for message in messages]

    def _predict_probabilities(self, text: str) -> dict[str, float]:
        if not hasattr(self.model, "predict_proba"):
            return {class_name: 0.0 for class_name in CANONICAL_CLASSES}

        raw_probabilities = self.model.predict_proba([text])[0]
        raw_classes = getattr(self.model, "classes_", None)
        if raw_classes is None and hasattr(self.model, "named_steps"):
            raw_classes = self.model.named_steps["classifier"].classes_

        probabilities = {class_name: 0.0 for class_name in CANONICAL_CLASSES}
        for raw_class, probability in zip(raw_classes, raw_probabilities):
            class_name = self._to_class_name(raw_class)
            probabilities[class_name] = probabilities.get(class_name, 0.0) + float(probability)
        return probabilities

    def _patch_loaded_model(self) -> None:
        classifier = None
        if hasattr(self.model, "named_steps"):
            classifier = self.model.named_steps.get("classifier")

        if classifier is not None and classifier.__class__.__name__ == "LogisticRegression":
            if not hasattr(classifier, "multi_class"):
                classifier.multi_class = "auto"

    def _needs_review(self, text: str, confidence: float, reason: str) -> dict[str, Any]:
        return {
            "label": "needs_review",
            "class_name": "needs_review",
            "confidence": float(confidence),
            "max_probability": float(confidence),
            "probabilities": {class_name: 0.0 for class_name in CANONICAL_CLASSES},
            "needs_review": True,
            "review_reason": reason,
            "message": text,
        }

    def _to_class_name(self, raw_label: Any) -> str:
        if isinstance(raw_label, str):
            return CLASS_ALIASES.get(raw_label.lower(), raw_label.lower())
        return LEGACY_LABELS.get(int(raw_label), str(raw_label))

    @staticmethod
    def _clean_message(message: str) -> str:
        return str(message or "").strip()


if __name__ == "__main__":
    predictor = ChatPredictor()
    for result in predictor.predict_batch([
        "Как это работает?",
        "Подготовь отчет к пятнице",
        "Принял, сейчас посмотрю",
        "",
    ]):
        print(result)
