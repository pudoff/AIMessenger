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
QUESTION_RE = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(word) for word in QUESTION_WORDS) + r")(?!\w)",
    re.IGNORECASE,
)
TASK_RE = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(word) for word in TASK_WORDS) + r")(?!\w)",
    re.IGNORECASE,
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


def _needs_review_result(reason, confidence=0.35, probabilities=None):
    result = _result("needs_review", confidence=confidence)
    if probabilities:
        result["probabilities"] = probabilities
    result["needs_review"] = True
    result["review_reason"] = reason
    return result


def _tokens(text, pattern=r"[a-zа-яё]+"):
    return re.findall(pattern, text or "", flags=re.IGNORECASE)


def _is_lorem_text(text):
    latin_tokens = [token.lower() for token in _tokens(text, r"[a-z]+")]
    return sum(1 for token in latin_tokens if token in LOREM_WORDS) >= 2


def _has_known_ru_signal(token):
    normalized = token.lower().replace("ё", "е")
    return normalized in COMMON_RU_WORDS or any(fragment in normalized for fragment in KNOWN_RU_FRAGMENTS)


def _looks_like_gibberish(text):
    cyrillic_tokens = [token.lower().replace("ё", "е") for token in _tokens(text, r"[а-яё]+")]
    if not cyrillic_tokens:
        return False
    if any(_has_known_ru_signal(token) for token in cyrillic_tokens):
        return False

    long_tokens = [token for token in cyrillic_tokens if len(token) >= 6]
    if not long_tokens:
        return False
    if len(cyrillic_tokens) == 1:
        return True
    return len(long_tokens) / len(cyrillic_tokens) >= 0.6


def _review_reason(text):
    if _is_lorem_text(text):
        return "lorem_ipsum"
    if _looks_like_gibberish(text):
        return "gibberish"
    return None


def _has_question_signal(text):
    lowered = (text or "").lower().replace("ё", "е")
    return "?" in lowered or bool(QUESTION_RE.search(lowered))


def _has_task_signal(text):
    lowered = (text or "").lower().replace("ё", "е")
    return bool(IMPERATIVE_RE.search(lowered) or TASK_RE.search(lowered))


def _adjust_result(result, label, confidence):
    adjusted = dict(result)
    probabilities = dict(adjusted.get("probabilities") or {})
    adjusted["label"] = label
    adjusted["class_name"] = label
    adjusted["confidence"] = confidence
    adjusted["max_probability"] = confidence
    adjusted["needs_review"] = False
    if probabilities:
        probabilities[label] = max(probabilities.get(label, 0), confidence)
        adjusted["probabilities"] = probabilities
    return adjusted


def postprocess_classification_result(text, result):
    probabilities = result.get("probabilities") or {}
    confidence = float(result.get("confidence") or result.get("max_probability") or 0)
    reason = _review_reason(text)
    if reason:
        return _needs_review_result(reason, confidence=min(confidence or 0.35, 0.4), probabilities=probabilities)

    label = result.get("class_name") or result.get("label")
    if label != "offtopic" and _has_task_signal(text):
        return _adjust_result(result, "task", max(confidence, 0.9))
    if label not in ("offtopic", "task") and _has_question_signal(text):
        return _adjust_result(result, "question", max(confidence, 0.9))
    if label == "question" and not _has_question_signal(text):
        return _adjust_result(result, "default", max(min(confidence, 0.72), 0.62))

    return result


def _mock_predict(text):
    lowered = (text or "").lower().replace("ё", "е")

    if any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in TOXIC_PATTERNS):
        return _result("offtopic", confidence=0.94)
    if GREETING_RE.search(lowered):
        return _result("default", confidence=0.92)
    if IMPERATIVE_RE.search(lowered):
        return _result("task", confidence=0.9)
    reason = _review_reason(lowered)
    if reason:
        return _needs_review_result(reason)
    if _has_question_signal(lowered):
        return _result("question")
    if TASK_RE.search(lowered):
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

    result = postprocess_classification_result(text, result)
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
