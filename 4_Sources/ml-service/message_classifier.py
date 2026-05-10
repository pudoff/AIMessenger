# Установка зависимостей
# pip install faker pandas

import pandas as pd
import numpy as np
import random
import re
import json
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib
import os


class ChatMessageClassifier:
    """
    Улучшенный классификатор сообщений чата.
    Реализует: аугментацию, GridSearchCV (f1_macro), балансировку,
    детальный аудит классов и сохранение артефактов.
    """

    def __init__(self, csv_path: str, random_state: int = 42):
        self.csv_path = csv_path
        self.random_state = random_state
        self.df = None
        self.X_train = self.X_test = self.y_train = self.y_test = None
        self.best_model = None
        self.class_names = {0: 'question', 1: 'answer', 2: 'task', 3: 'toxic'}
        self.synonyms = {
            'тупой': ['глупый', 'бестолковый', 'недалёкий'],
            'идиот': ['кретин', 'придурок', 'болван'],
            'отвали': ['исчезни', 'проваливай', 'уйди'],
            'заткнись': ['замолчи', 'не ной', 'хватит болтать']
        }

    def load_data(self) -> None:
        """Загрузка и базовая очистка."""
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"Файл {self.csv_path} не найден.")
        self.df = pd.read_csv(self.csv_path, encoding='utf-8-sig')
        self.df.dropna(subset=['text', 'label'], inplace=True)
        self.df['label'] = self.df['label'].astype(int)
        self.df['text'] = self.df['text'].astype(str).str.strip()
        print(f"✅ Загружено {len(self.df)} записей.")

    def augment_toxic_class(self, multiplier: int = 5) -> None:
        """Аугментация класса 3 (toxic) для борьбы с дисбалансом."""
        toxic_mask = self.df['label'] == 3
        toxic_df = self.df[toxic_mask].copy()
        if len(toxic_df) == 0:
            print("⚠️ Класс toxic отсутствует. Пропуск аугментации.")
            return

        augmented_texts = []
        random.seed(self.random_state)

        for text in toxic_df['text'].values:
            # 1. Изменение регистра
            augmented_texts.append(text.upper())
            # 2. Добавление/изменение пунктуации
            augmented_texts.append(text + random.choice(["!!!", "...", "??", "!!11"]))
            # 3. Вставка случайных пробелов внутри слов (имитация опечаток)
            if len(text) > 5:
                idx = random.randint(1, len(text) - 2)
                augmented_texts.append(text[:idx] + " " + text[idx:])
            # 4. Замена слов на синонимы
            words = text.split()
            if random.random() > 0.5:
                for orig, subs in self.synonyms.items():
                    if orig in words:
                        new_words = [random.choice(subs) if w == orig else w for w in words]
                        augmented_texts.append(" ".join(new_words))
                        break

        # Создаём новые записи
        new_df = pd.DataFrame({'text': augmented_texts, 'label': 3})
        self.df = pd.concat([self.df, new_df], ignore_index=True)
        print(f"🔍 Аугментация: добавлено {len(new_df)} синтетических примеров класса toxic.")
        print(f"   Новое распределение:\n{self.df['label'].value_counts().sort_index()}")

    def split_data(self, test_size: float = 0.2) -> None:
        """Стратифицированное разбиение (после аугментации, чтобы не было leakage)."""
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.df['text'], self.df['label'],
            test_size=test_size,
            random_state=self.random_state,
            stratify=self.df['label']
        )
        print(f"🔀 Разделение: Train={len(self.X_train)}, Test={len(self.X_test)}")

    def setup_pipeline(self) -> Pipeline:
        """Базовый пайплайн с балансировкой весов."""
        return Pipeline([
            ("tfidf", TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(3, 5),
                max_features=100_000,
                sublinear_tf=True  # Уменьшает вес частых n-gram
            )),
            ("classifier", LogisticRegression(
                max_iter=1000,
                class_weight='balanced',  # ✅ Критично для дисбаланса
                n_jobs=-1,
                random_state=self.random_state
            ))
        ])

    def tune_hyperparameters(self) -> dict:
        """GridSearchCV с оптимизацией по f1_macro."""
        print("⚙️ Запуск подбора гиперпараметров (cv=3, scoring='f1_macro')...")
        pipeline = self.setup_pipeline()

        # Компактная сетка для ускорения
        param_grid = {
            'tfidf__ngram_range': [(2, 4), (3, 5)],
            'tfidf__max_features': [50_000, 100_000],
            'classifier__C': [0.5, 1.0, 2.0]
        }

        grid = GridSearchCV(
            pipeline, param_grid,
            cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=self.random_state),
            scoring='f1_macro',
            n_jobs=-1,
            verbose=1,
            refit=True
        )
        grid.fit(self.X_train, self.y_train)
        self.best_model = grid.best_estimator_
        print(f"🏆 Лучшие параметры: {grid.best_params_}")
        print(f"📈 Лучший CV f1_macro: {grid.best_score_:.4f}")
        return grid.best_params_

    def evaluate(self) -> dict:
        """Детальная оценка с акцентом на миноритарные классы."""
        y_pred = self.best_model.predict(self.X_test)
        report = classification_report(self.y_test, y_pred, output_dict=True)

        print("\n📊 Classification Report (Test):")
        print(classification_report(
            self.y_test, y_pred,
            target_names=[self.class_names[i] for i in range(4)]
        ))

        # Явный вывод метрик для toxic
        toxic_f1 = report.get('3', {}).get('f1-score', 0)
        toxic_recall = report.get('3', {}).get('recall', 0)
        print(f"🚨 Toxic F1: {toxic_f1:.3f} | Recall: {toxic_recall:.3f}")

        # Сохранение матрицы ошибок
        cm = confusion_matrix(self.y_test, y_pred)
        cm_df = pd.DataFrame(cm, index=[self.class_names[i] for i in range(4)],
                             columns=[self.class_names[i] for i in range(4)])
        cm_df.to_csv("confusion_matrix.csv", index=True)
        print("💾 Confusion matrix saved to: confusion_matrix.csv")

        return report

    def inspect_weights(self) -> None:
        """Анализ топ-признаков с учётом обученных весов."""
        tfidf = self.best_model.named_steps['tfidf']
        clf = self.best_model.named_steps['classifier']
        feature_names = tfidf.get_feature_names_out()

        print("\n🔍 Топ-5 n-gram по классам (по весу):")
        for class_idx in range(4):
            top_idx = clf.coef_[class_idx].argsort()[-5:][::-1]
            top_feat = [feature_names[i] for i in top_idx]
            print(f"  [{self.class_names[class_idx]:>8}]: {top_feat}")

    def save_artifacts(self, model_path: str = "chat_classifier_final.pkl",
                       metrics_path: str = "training_metrics.json") -> None:
        """Сохранение модели и метрик."""
        joblib.dump(self.best_model, model_path)
        print(f"💾 Модель сохранена: {model_path}")

        # Сохраняем ключевые метрики для аудита
        metrics = {
            "best_params": {k: str(v) for k, v in self.best_model.named_steps['classifier'].get_params().items() if
                            k in ['C', 'max_iter']},
            "n_train_samples": len(self.X_train),
            "n_test_samples": len(self.X_test),
            "class_distribution_train": self.y_train.value_counts().to_dict()
        }
        with open(metrics_path, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        print(f"💾 Метрики сохранены: {metrics_path}")

    def run(self, test_size: float = 0.2) -> None:
        """Оркестратор пайплайна."""
        self.load_data()
        self.augment_toxic_class(multiplier=5)
        self.split_data(test_size)
        self.tune_hyperparameters()
        report = self.evaluate()
        self.inspect_weights()
        self.save_artifacts()
        print("\n✅ Пайплайн завершён успешно.")


if __name__ == "__main__":
    DATASET_PATH = "chat_dataset.csv"
    classifier = ChatMessageClassifier(csv_path=DATASET_PATH)
    classifier.run(test_size=0.2)