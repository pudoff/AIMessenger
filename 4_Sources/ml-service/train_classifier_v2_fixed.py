import pandas as pd
import random
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib
import json
from pathlib import Path

class ChatMessageClassifier:
    def __init__(self, csv_path, random_state=42):
        self.csv_path = Path(csv_path)
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

    def load_data(self):
        if not self.csv_path.exists():
            raise FileNotFoundError(f"File {self.csv_path} not found.")
        self.df = pd.read_csv(self.csv_path, encoding='utf-8-sig')
        self.df.dropna(subset=['text', 'label'], inplace=True)
        self.df['label'] = self.df['label'].astype(int)
        self.df['text'] = self.df['text'].astype(str).str.strip()

    def split_data(self, test_size=0.2):
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.df['text'], self.df['label'],
            test_size=test_size,
            random_state=self.random_state,
            stratify=self.df['label']
        )

    def augment_toxic_class(self, df, multiplier=5):
        toxic_mask = df['label'] == 3
        toxic_df = df[toxic_mask].copy()
        if len(toxic_df) == 0:
            return df

        augmented_texts = []
        augmented_labels = []
        random.seed(self.random_state)

        for text in toxic_df['text'].values:
            # 1. Изменение регистра
            augmented_texts.append(text.upper())
            augmented_labels.append(3)
            # 2. Пунктуация
            augmented_texts.append(text + random.choice(["!!!", "...", "??", "!!11"]))
            augmented_labels.append(3)
            # 3. Вставка пробелов
            if len(text) > 5:
                idx = random.randint(1, len(text)-2)
                augmented_texts.append(text[:idx] + " " + text[idx:])
                augmented_labels.append(3)
            # 4. Замена слов на синонимы
            words = text.split()
            for orig, subs in self.synonyms.items():
                if orig in words:
                    new_words = [random.choice(subs) if w == orig else w for w in words]
                    augmented_texts.append(" ".join(new_words))
                    augmented_labels.append(3)
                    break

        new_df = pd.DataFrame({'text': augmented_texts, 'label': augmented_labels})
        return pd.concat([df, new_df], ignore_index=True)

    def setup_pipeline(self):
        return Pipeline([
            ("tfidf", TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(3, 5),
                max_features=100_000,
                sublinear_tf=True
            )),
            ("classifier", LogisticRegression(
                max_iter=1000,
                class_weight='balanced',
                random_state=self.random_state
            ))
        ])

    def tune_hyperparameters(self):
        pipeline = self.setup_pipeline()
        param_grid = {
            'tfidf__ngram_range': [(2, 4), (3, 5)],
            'tfidf__max_features': [50_000, 100_000],
            'classifier__C': [0.5, 1.0, 2.0]
        }

        grid = GridSearchCV(
            pipeline, param_grid,
            cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=self.random_state),
            scoring='f1_macro',
            n_jobs=1,
            verbose=1,
            refit=True
        )
        grid.fit(self.X_train, self.y_train)
        self.best_model = grid.best_estimator_
        return grid.best_params_

    def evaluate(self):
        y_pred = self.best_model.predict(self.X_test)
        report = classification_report(self.y_test, y_pred, output_dict=True)

        print(classification_report(
            self.y_test, y_pred,
            target_names=[self.class_names[i] for i in range(4)]
        ))

        cm = confusion_matrix(self.y_test, y_pred)
        cm_df = pd.DataFrame(cm, index=[self.class_names[i] for i in range(4)],
                             columns=[self.class_names[i] for i in range(4)])
        return report, cm_df

    def save_artifacts(self, model_path, metrics_path, confusion_matrix_path):
        joblib.dump(self.best_model, model_path)
        report, cm_df = self.evaluate()
        metrics = {
            "best_params": {k: str(v) for k, v in self.best_model.named_steps['classifier'].get_params().items() if k in ['C', 'max_iter']},
            "n_train_samples": len(self.X_train),
            "n_test_samples": len(self.X_test),
            "class_distribution_train": self.y_train.value_counts().to_dict(),
            "classification_report": report
        }
        with metrics_path.open('w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        cm_df.to_csv(confusion_matrix_path, index=True)

    def run(self, test_size=0.2):
        self.load_data()
        self.split_data(test_size)

        # Аугментация train-части
        train_df = pd.DataFrame({'text': self.X_train, 'label': self.y_train})
        train_df = self.augment_toxic_class(train_df)
        self.X_train = train_df['text']
        self.y_train = train_df['label']

        self.tune_hyperparameters()
        report, cm_df = self.evaluate()

        base_dir = Path(__file__).resolve().parent
        artifacts_dir = base_dir / "artifacts"
        artifacts_dir.mkdir(exist_ok=True)

        model_path = artifacts_dir / "chat_classifier_final.pkl"
        metrics_path = artifacts_dir / "training_metrics.json"
        confusion_matrix_path = artifacts_dir / "confusion_matrix.csv"

        self.save_artifacts(model_path, metrics_path, confusion_matrix_path)
        print(f"Model and artifacts saved to: {artifacts_dir}")


if __name__ == "__main__":
    dataset_path = Path(__file__).resolve().parent / "chat_dataset.csv"
    classifier = ChatMessageClassifier(dataset_path)
    classifier.run(test_size=0.2)