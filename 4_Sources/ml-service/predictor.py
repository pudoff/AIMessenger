import joblib
from pathlib import Path
import numpy as np

class ChatPredictor:
    def __init__(self, model_path=None):
        if model_path is None:
            base_dir = Path(__file__).resolve().parent
            model_path = base_dir / "artifacts" / "chat_classifier_final.pkl"
        self.model = joblib.load(model_path)
        self.class_names = {0: 'question', 1: 'answer', 2: 'task', 3: 'toxic'}

    def predict_one(self, message):
        prediction = self.model.predict([message])[0]
        probas = self.model.predict_proba([message])[0]
        return {
            'label': int(prediction),
            'class_name': self.class_names[int(prediction)],
            'probabilities': {self.class_names[i]: float(probas[i]) for i in range(len(probas))}
        }

    def predict_batch(self, messages):
        predictions = self.model.predict(messages)
        probas = self.model.predict_proba(messages)
        results = []
        for i, pred in enumerate(predictions):
            results.append({
                'label': int(pred),
                'class_name': self.class_names[int(pred)],
                'probabilities': {self.class_names[j]: float(probas[i][j]) for j in range(len(probas[i]))},
                'message': messages[i]
            })
        return results

if __name__ == "__main__":
    predictor = ChatPredictor()
    sample_message = "Привет, как дела?"
    result = predictor.predict_one(sample_message)
    print(result)

    batch_messages = ["Привет", "Заткнись", "Сделай отчет", "Как это работает?"]
    batch_results = predictor.predict_batch(batch_messages)
    for res in batch_results:
        print(res)