import re
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


_predictor = None
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
QUESTION_WORDS = (
    "как",
    "что",
    "когда",
    "почему",
    "зачем",
    "где",
    "куда",
    "кто",
    "which",
    "what",
    "when",
    "why",
    "how",
    "where",
    "who",
)
TASK_WORDS = (
    "сделай",
    "сделать",
    "нужно",
    "надо",
    "задача",
    "дедлайн",
    "подготовь",
    "проверь",
    "исправь",
    "добавь",
    "todo",
    "task",
    "deadline",
    "please",
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
    "уточни",
    "уточните",
)
IMPERATIVE_RE = re.compile(
    r"(?:^|[\s,;:])(" + "|".join(re.escape(verb) for verb in IMPERATIVE_VERBS) + r")(?:$|[\s,.!?;:])",
    re.IGNORECASE,
)


def _result(label, confidence=0.72):
    other_labels = ("question", "default", "task", "offtopic")
    other_probability = (1.0 - confidence) / (len(other_labels) - 1)
    probabilities = {
        item: other_probability
        for item in other_labels
    }
    probabilities[label] = confidence
    return {
        "label": label,
        "confidence": confidence,
        "probabilities": probabilities,
    }


def _mock_predict(text):
    lowered = (text or "").lower().replace("ё", "е")

    if any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in TOXIC_PATTERNS):
        return _result("offtopic", confidence=0.94)
    if IMPERATIVE_RE.search(lowered):
        return _result("task", confidence=0.9)
    if "?" in lowered or any(word in lowered for word in QUESTION_WORDS):
        return _result("question")
    if any(word in lowered for word in TASK_WORDS):
        return _result("task", confidence=0.9)
    return _result("default")


def _load_predictor():
    global _predictor
    if _predictor is not None:
        return _predictor

    predictor_path = Path(__file__).resolve().parents[2] / "ml-service" / "predictor.py"
    if not predictor_path.exists():
        return None

    try:
        spec = spec_from_file_location("aimessenger_ml_predictor", predictor_path)
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        _predictor = module.ChatPredictor()
        return _predictor
    except Exception:
        return None


def classify_text(text):
    predictor = _load_predictor()
    if predictor is None:
        return _mock_predict(text)

    try:
        result = predictor.predict_one(text)
    except Exception:
        return _mock_predict(text)

    probabilities = result.get("probabilities") or {}
    label = result.get("class_name") or result.get("label") or "needs_review"
    confidence = result.get("confidence")
    if confidence is None:
        confidence = max(probabilities.values()) if probabilities else 0

    return {
        "label": label,
        "confidence": float(confidence),
        "probabilities": probabilities,
    }
