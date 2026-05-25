from __future__ import annotations

import hashlib
import math
import random
from typing import Iterable


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DIMENSIONS = 384
MAX_TEXT_LENGTH = 8192


class TextEmbedder:
    def __init__(self, model_name: str = MODEL_NAME, load_model: bool = True) -> None:
        self.model_name = model_name
        self.model = None
        if not load_model:
            return
        try:
            from sentence_transformers import SentenceTransformer

            self.model = SentenceTransformer(model_name)
        except Exception:
            self.model = None

    def embed_one(self, text: str) -> dict:
        cleaned = self._clean_text(text)
        if self.model is not None:
            vector = self.model.encode(cleaned, normalize_embeddings=True).tolist()
        else:
            vector = self._fallback_vector(cleaned)
        return {
            "embedding": [float(value) for value in vector],
            "model_name": self.model_name if self.model is not None else "fallback-hash-embedding",
            "dimensions": len(vector),
        }

    def embed_batch(self, texts: Iterable[str]) -> list[dict]:
        return [self.embed_one(text) for text in texts]

    @staticmethod
    def _clean_text(text: str) -> str:
        cleaned = str(text or "").strip()
        if len(cleaned) < 2:
            raise ValueError("text is empty or too short")
        if len(cleaned) > MAX_TEXT_LENGTH:
            raise ValueError(f"text is longer than {MAX_TEXT_LENGTH} characters")
        return cleaned

    @staticmethod
    def _fallback_vector(text: str) -> list[float]:
        seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:16], 16)
        rng = random.Random(seed)
        vector = [rng.uniform(-1.0, 1.0) for _ in range(DIMENSIONS)]
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]
