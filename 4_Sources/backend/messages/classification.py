from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


_predictor = None


def _mock_predict(text):
    lowered = (text or '').lower()
    if '?' in lowered or any(word in lowered for word in ('как', 'что', 'когда', 'почему', 'зачем')):
        label = 'question'
    elif any(word in lowered for word in ('сделай', 'нужно', 'задача', 'дедлайн', 'todo')):
        label = 'task'
    else:
        label = 'default'

    return {
        'label': label,
        'confidence': 0.6,
        'probabilities': {label: 0.6},
    }


def _load_predictor():
    global _predictor
    if _predictor is not None:
        return _predictor

    predictor_path = Path(__file__).resolve().parents[2] / 'ml-service' / 'predictor.py'
    if not predictor_path.exists():
        return None

    try:
        spec = spec_from_file_location('aimessenger_ml_predictor', predictor_path)
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

    probabilities = result.get('probabilities') or {}
    label = result.get('class_name') or str(result.get('label', 'unknown'))
    confidence = max(probabilities.values()) if probabilities else 0
    return {
        'label': label,
        'confidence': confidence,
        'probabilities': probabilities,
    }
