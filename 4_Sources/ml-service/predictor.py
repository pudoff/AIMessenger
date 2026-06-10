from __future__ import annotations

import re
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
LOREM_WORDS = {"lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit"}
COMMON_RU_WORDS = {
    "а",
    "в",
    "вы",
    "да",
    "для",
    "еще",
    "и",
    "как",
    "мне",
    "мы",
    "на",
    "не",
    "но",
    "он",
    "она",
    "они",
    "по",
    "с",
    "ты",
    "у",
    "что",
    "это",
    "этих",
    "я",
}
KNOWN_RU_FRAGMENTS = (
    "аналит",
    "булок",
    "вопрос",
    "дела",
    "день",
    "документ",
    "задач",
    "мессендж",
    "мягк",
    "отчет",
    "парол",
    "письм",
    "пользоват",
    "проект",
    "регистрац",
    "сообщ",
    "тест",
    "файл",
    "француз",
    "чат",
)
QUESTION_WORDS = (
    "как",
    "что",
    "когда",
    "почему",
    "зачем",
    "где",
    "куда",
    "кто",
    "какой",
    "какая",
    "какие",
    "сколько",
    "можешь",
    "сможешь",
    "можно",
    "which",
    "what",
    "when",
    "why",
    "how",
    "where",
    "who",
)
QUESTION_RE = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(word) for word in QUESTION_WORDS) + r")(?!\w)",
    re.IGNORECASE,
)
GREETING_RE = re.compile(
    r"^\s*(?:"
    r"добрый\s+(?:день|вечер)|"
    r"доброе\s+утро|"
    r"доброго\s+дня|"
    r"здравствуйте|"
    r"привет|"
    r"приветствую|"
    r"hello|hi|good\s+(?:morning|afternoon|evening)"
    r")(?:[\s,!.]*(?:всем|коллеги|команда|друзья|ребята|товарищи))*[\s!.]*$",
    re.IGNORECASE,
)
TOXIC_PATTERNS = (
    r"\bдурак\b",
    r"\bдура\b",
    r"\bидиот\b",
    r"\bидиотка\b",
    r"\bдебил\b",
    r"\bтупица\b",
    r"\bтупой\b",
    r"\bтупая\b",
    r"\bкретин\b",
    r"\bурод\b",
    r"\bхам\b",
    r"\bзаткнись\b",
)
IMPERATIVE_VERBS = (
    "добавь",
    "добавьте",
    "забронируй",
    "забронируйте",
    "загрузи",
    "загрузите",
    "закрой",
    "закройте",
    "заполни",
    "заполните",
    "купи",
    "купите",
    "найди",
    "найдите",
    "напиши",
    "напишите",
    "напомни",
    "напомните",
    "обнови",
    "обновите",
    "открой",
    "откройте",
    "отправь",
    "отправьте",
    "передай",
    "передайте",
    "перешли",
    "перешлите",
    "подготовь",
    "подготовьте",
    "позвони",
    "позвоните",
    "покажи",
    "покажите",
    "посмотри",
    "посмотрите",
    "проверь",
    "проверьте",
    "принеси",
    "принесите",
    "распечатай",
    "распечатайте",
    "сделай",
    "сделайте",
    "скачай",
    "скачайте",
    "собери",
    "соберите",
    "создай",
    "создайте",
    "съешь",
    "съешьте",
    "съеште",
    "уточни",
    "уточните",
)
IMPERATIVE_RE = re.compile(
    r"(?:^|[\s,;:])(" + "|".join(re.escape(verb) for verb in IMPERATIVE_VERBS) + r")(?:$|[\s,.!?;:])",
    re.IGNORECASE,
)


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

        rule_label = self._predict_by_priority_rules(text)
        if rule_label:
            return self._rule_result(text, rule_label)

        review_reason = self._review_reason(text)
        if review_reason:
            return self._needs_review(text, confidence=0.35, reason=review_reason)

        raw_prediction = self.model.predict([text])[0]
        probabilities = self._predict_probabilities(text)
        predicted_class = self._to_class_name(raw_prediction)
        confidence = float(probabilities.get(predicted_class, 0.0))

        if predicted_class == "question" and not self._has_question_signal(text):
            predicted_class = "statement"
            confidence = max(min(confidence, 0.72), 0.62)
            probabilities["statement"] = max(probabilities.get("statement", 0.0), confidence)

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

    def _rule_result(self, text: str, label: str) -> dict[str, Any]:
        confidence = 0.94 if label == "offtopic" else 0.9
        other_probability = (1.0 - confidence) / (len(CANONICAL_CLASSES) - 1)
        probabilities = {class_name: other_probability for class_name in CANONICAL_CLASSES}
        probabilities[label] = confidence
        return {
            "label": label,
            "class_name": label,
            "confidence": confidence,
            "max_probability": confidence,
            "probabilities": probabilities,
            "needs_review": False,
            "message": text,
            "source": "rules",
        }

    @staticmethod
    def _predict_by_priority_rules(text: str) -> str | None:
        lowered = text.lower().replace("ё", "е")
        if any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in TOXIC_PATTERNS):
            return "offtopic"
        if GREETING_RE.search(lowered):
            return "statement"
        if IMPERATIVE_RE.search(lowered):
            return "task"
        if "?" in lowered or QUESTION_RE.search(lowered):
            return "question"
        return None

    def _to_class_name(self, raw_label: Any) -> str:
        if isinstance(raw_label, str):
            return CLASS_ALIASES.get(raw_label.lower(), raw_label.lower())
        return LEGACY_LABELS.get(int(raw_label), str(raw_label))

    @staticmethod
    def _clean_message(message: str) -> str:
        return str(message or "").strip()

    @classmethod
    def _review_reason(cls, text: str) -> str | None:
        if cls._is_lorem_text(text):
            return "lorem_ipsum"
        if cls._looks_like_gibberish(text):
            return "gibberish"
        return None

    @staticmethod
    def _tokens(text: str, pattern: str = r"[a-zа-яё]+") -> list[str]:
        return re.findall(pattern, text or "", flags=re.IGNORECASE)

    @classmethod
    def _is_lorem_text(cls, text: str) -> bool:
        latin_tokens = [token.lower() for token in cls._tokens(text, r"[a-z]+")]
        return sum(1 for token in latin_tokens if token in LOREM_WORDS) >= 2

    @classmethod
    def _looks_like_gibberish(cls, text: str) -> bool:
        cyrillic_tokens = [token.lower().replace("ё", "е") for token in cls._tokens(text, r"[а-яё]+")]
        if not cyrillic_tokens:
            return False
        if any(cls._has_known_ru_signal(token) for token in cyrillic_tokens):
            return False

        long_tokens = [token for token in cyrillic_tokens if len(token) >= 6]
        if not long_tokens:
            return False
        if len(cyrillic_tokens) == 1:
            return True
        return len(long_tokens) / len(cyrillic_tokens) >= 0.6

    @staticmethod
    def _has_known_ru_signal(token: str) -> bool:
        normalized = token.lower().replace("ё", "е")
        return normalized in COMMON_RU_WORDS or any(fragment in normalized for fragment in KNOWN_RU_FRAGMENTS)

    @staticmethod
    def _has_question_signal(text: str) -> bool:
        lowered = (text or "").lower().replace("ё", "е")
        return "?" in lowered or bool(QUESTION_RE.search(lowered))


if __name__ == "__main__":
    predictor = ChatPredictor()
    for result in predictor.predict_batch([
        "Как это работает?",
        "Подготовь отчет к пятнице",
        "Принял, сейчас посмотрю",
        "",
    ]):
        print(result)
