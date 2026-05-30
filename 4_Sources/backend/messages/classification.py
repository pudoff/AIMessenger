from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


_predictor = None


def _mock_predict(text):
    lowered = (text or "").lower()
    question_words = (
        "как", "что", "когда", "почему", "зачем", "где", "куда", "кто",
        "which", "what", "when", "why", "how", "where", "who",
    )
    task_words = (
        "сделай", "сделать", "нужно", "надо", "задача", "дедлайн", "подготовь",
        "проверь", "исправь", "добавь", "todo", "task", "deadline", "please",
    )

    if "?" in lowered or any(word in lowered for word in question_words):
        label = "question"
    elif any(word in lowered for word in task_words):
        label = "task"
    else:
        label = "default"

    return {
        "label": label,
        "confidence": 0.72,
        "probabilities": {
            "question": 0.0,
            "default": 0.0,
            "task": 0.0,
            "offtopic": 0.0,
            label: 0.72,
        },
    }


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
