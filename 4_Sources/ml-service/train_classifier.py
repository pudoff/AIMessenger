from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline


BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
DATASET_PATH = ARTIFACTS_DIR / "chat_dataset.csv"
MODEL_PATH = ARTIFACTS_DIR / "chat_classifier_final.pkl"
METRICS_PATH = ARTIFACTS_DIR / "training_metrics.json"
CONFUSION_MATRIX_PATH = ARTIFACTS_DIR / "confusion_matrix.csv"
DATASET_REPORT_PATH = ARTIFACTS_DIR / "dataset_quality_report.json"

RANDOM_SEED = 42
CANONICAL_CLASSES = ("question", "statement", "task", "offtopic")
LABEL_TO_CLASS = {
    0: "question",
    1: "statement",
    2: "task",
    3: "offtopic",
}
CLASS_ALIASES = {
    "question": "question",
    "task": "task",
    "answer": "statement",
    "statement": "statement",
    "default": "statement",
    "toxic": "offtopic",
    "offtopic": "offtopic",
}


@dataclass(frozen=True)
class DatasetInfo:
    version: str
    rows: int
    columns: list[str]
    class_distribution: dict[str, int]


def normalize_text(value: Any) -> str:
    text = str(value or "").lower().strip()
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "<email>", text)
    text = re.sub(r"https?://\S+|www\.\S+", "<url>", text)
    text = re.sub(r"\d+", "<num>", text)
    return re.sub(r"\s+", " ", text)


def dataset_version(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:12]


class ChatMessageClassifier:
    def __init__(
        self,
        dataset_path: Path = DATASET_PATH,
        artifacts_dir: Path = ARTIFACTS_DIR,
        random_seed: int = RANDOM_SEED,
    ) -> None:
        self.dataset_path = Path(dataset_path)
        self.artifacts_dir = Path(artifacts_dir)
        self.random_seed = random_seed
        self.dataset: pd.DataFrame | None = None
        self.x_train = self.x_test = self.y_train = self.y_test = None
        self.best_model: Pipeline | None = None
        self.best_params: dict[str, Any] = {}
        self.best_cv_score: float | None = None

    def load_data(self) -> pd.DataFrame:
        if not self.dataset_path.exists():
            raise FileNotFoundError(f"Dataset not found: {self.dataset_path}")

        df = pd.read_csv(self.dataset_path, encoding="utf-8-sig")
        required_columns = {"text"}
        if not required_columns.issubset(df.columns):
            raise ValueError(f"Dataset must contain columns: {sorted(required_columns)}")

        df = df.dropna(subset=["text"]).copy()
        df["text"] = df["text"].astype(str).str.strip()
        df = df[df["text"].str.len() > 0]
        df["class_name"] = self._resolve_class_names(df)
        df = df[df["class_name"].isin(CANONICAL_CLASSES)].copy()
        df = df.drop_duplicates(subset=["text", "class_name"]).reset_index(drop=True)
        self.dataset = df
        return df

    def _resolve_class_names(self, df: pd.DataFrame) -> pd.Series:
        if "class_name" in df.columns:
            values = df["class_name"].astype(str).str.strip().str.lower()
            return values.map(CLASS_ALIASES)

        if "label" not in df.columns:
            raise ValueError("Dataset must contain either class_name or label column.")

        labels = pd.to_numeric(df["label"], errors="coerce").astype("Int64")
        return labels.map(LABEL_TO_CLASS)

    def split_data(self, test_size: float) -> None:
        if self.dataset is None:
            raise RuntimeError("Dataset is not loaded.")

        self.x_train, self.x_test, self.y_train, self.y_test = train_test_split(
            self.dataset["text"],
            self.dataset["class_name"],
            test_size=test_size,
            random_state=self.random_seed,
            stratify=self.dataset["class_name"],
        )

    def build_pipeline(self) -> Pipeline:
        return Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        analyzer="char_wb",
                        ngram_range=(3, 5),
                        max_features=100_000,
                        sublinear_tf=True,
                    ),
                ),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=1000,
                        class_weight="balanced",
                        random_state=self.random_seed,
                    ),
                ),
            ]
        )

    def fit(self, use_grid_search: bool = True) -> None:
        if self.x_train is None or self.y_train is None:
            raise RuntimeError("Data is not split.")

        pipeline = self.build_pipeline()
        if not use_grid_search:
            self.best_model = pipeline.fit(self.x_train, self.y_train)
            self.best_params = {}
            self.best_cv_score = None
            return

        grid = GridSearchCV(
            pipeline,
            {
                "tfidf__ngram_range": [(2, 4), (3, 5)],
                "tfidf__max_features": [50_000, 100_000],
                "classifier__C": [0.5, 1.0, 2.0],
            },
            cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=self.random_seed),
            scoring="f1_macro",
            n_jobs=1,
            verbose=1,
            refit=True,
        )
        grid.fit(self.x_train, self.y_train)
        self.best_model = grid.best_estimator_
        self.best_params = dict(grid.best_params_)
        self.best_cv_score = float(grid.best_score_)

    def evaluate(self) -> tuple[dict[str, Any], pd.DataFrame]:
        if self.best_model is None:
            raise RuntimeError("Model is not trained.")

        predictions = self.best_model.predict(self.x_test)
        report = classification_report(
            self.y_test,
            predictions,
            labels=list(CANONICAL_CLASSES),
            output_dict=True,
            zero_division=0,
        )
        metrics = {
            "test_accuracy": float(accuracy_score(self.y_test, predictions)),
            "macro_f1": float(f1_score(self.y_test, predictions, average="macro", zero_division=0)),
            "weighted_f1": float(f1_score(self.y_test, predictions, average="weighted", zero_division=0)),
            "classification_report": report,
            "per_class_metrics": {
                class_name: report.get(class_name, {})
                for class_name in CANONICAL_CLASSES
            },
        }
        matrix = confusion_matrix(self.y_test, predictions, labels=list(CANONICAL_CLASSES))
        matrix_df = pd.DataFrame(matrix, index=CANONICAL_CLASSES, columns=CANONICAL_CLASSES)
        return metrics, matrix_df

    def dataset_info(self) -> DatasetInfo:
        if self.dataset is None:
            raise RuntimeError("Dataset is not loaded.")

        return DatasetInfo(
            version=dataset_version(self.dataset_path),
            rows=int(len(self.dataset)),
            columns=list(self.dataset.columns),
            class_distribution={
                key: int(value)
                for key, value in self.dataset["class_name"].value_counts().sort_index().items()
            },
        )

    def save_artifacts(self) -> None:
        if self.best_model is None:
            raise RuntimeError("Model is not trained.")

        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        metrics, matrix_df = self.evaluate()
        info = self.dataset_info()
        payload = {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "random_seed": self.random_seed,
            "dataset_version": info.version,
            "dataset_size": info.rows,
            "dataset_columns": info.columns,
            "class_distribution": info.class_distribution,
            "n_train_samples": int(len(self.x_train)),
            "n_test_samples": int(len(self.x_test)),
            "taxonomy": {
                "canonical_classes": list(CANONICAL_CLASSES),
                "legacy_mapping": CLASS_ALIASES,
            },
            "best_params": self.best_params,
            "best_cv_score": self.best_cv_score,
            **metrics,
        }

        joblib.dump(self.best_model, MODEL_PATH)
        write_json(METRICS_PATH, payload)
        matrix_df.to_csv(CONFUSION_MATRIX_PATH, index=True)

    def run(self, test_size: float, use_grid_search: bool) -> None:
        self.load_data()
        self.split_data(test_size)
        self.fit(use_grid_search=use_grid_search)
        self.save_artifacts()


def build_dataset_report(dataset_path: Path = DATASET_PATH, random_seed: int = RANDOM_SEED) -> dict[str, Any]:
    classifier = ChatMessageClassifier(dataset_path=dataset_path, random_seed=random_seed)
    df = classifier.load_data()
    train_df, test_df = train_test_split(
        df,
        test_size=0.2,
        random_state=random_seed,
        stratify=df["class_name"],
    )

    normalized = df["text"].map(normalize_text)
    train_normalized = set(train_df["text"].map(normalize_text))
    test_normalized = set(test_df["text"].map(normalize_text))
    signature_counts = normalized.value_counts()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": str(dataset_path),
        "dataset_version": dataset_version(dataset_path),
        "dataset_rows": int(len(df)),
        "class_distribution": classifier.dataset_info().class_distribution,
        "exact_duplicate_texts": int(df.duplicated(subset=["text"]).sum()),
        "exact_duplicate_text_label_pairs": int(df.duplicated(subset=["text", "class_name"]).sum()),
        "normalized_duplicate_texts": int(normalized.duplicated().sum()),
        "train_test_normalized_overlap": int(len(train_normalized.intersection(test_normalized))),
        "unique_text_ratio": float(df["text"].nunique() / len(df)),
        "unique_normalized_text_ratio": float(normalized.nunique() / len(df)),
        "top_repeated_normalized_templates": signature_counts.head(20).to_dict(),
    }
    return report


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the chat message classifier.")
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--random-seed", type=int, default=RANDOM_SEED)
    parser.add_argument("--no-grid", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()

    if args.report_only:
        write_json(DATASET_REPORT_PATH, build_dataset_report(args.dataset, args.random_seed))
        print(f"Dataset report saved to {DATASET_REPORT_PATH}")
        return

    classifier = ChatMessageClassifier(dataset_path=args.dataset, random_seed=args.random_seed)
    classifier.run(test_size=args.test_size, use_grid_search=not args.no_grid)
    write_json(DATASET_REPORT_PATH, build_dataset_report(args.dataset, args.random_seed))
    print(f"Model artifacts saved to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
