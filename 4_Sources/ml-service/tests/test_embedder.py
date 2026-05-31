import pytest

from embedder import DIMENSIONS, TextEmbedder


def test_embedder_returns_contract(monkeypatch):
    embedder = TextEmbedder(load_model=False)

    result = embedder.embed_one("Привет, нужно подготовить отчет")

    assert set(result) == {"embedding", "model_name", "dimensions"}
    assert result["dimensions"] == DIMENSIONS
    assert len(result["embedding"]) == DIMENSIONS


def test_embedder_rejects_short_text():
    embedder = TextEmbedder(load_model=False)

    with pytest.raises(ValueError):
        embedder.embed_one(" ")
