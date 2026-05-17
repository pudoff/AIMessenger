import unittest

from predictor import CANONICAL_CLASSES, ChatPredictor


class ChatPredictorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = ChatPredictor(confidence_threshold=0.0)

    def test_model_loads(self):
        self.assertIsNotNone(self.predictor.model)

    def test_predict_one_returns_label_and_confidence(self):
        result = self.predictor.predict_one("Какой статус по задаче?")

        self.assertIn("class_name", result)
        self.assertIn("confidence", result)
        self.assertIn("probabilities", result)
        self.assertIsInstance(result["confidence"], float)

    def test_predict_batch_returns_result_for_each_message(self):
        messages = ["Как дела?", "Подготовь отчет", "Принял"]
        results = self.predictor.predict_batch(messages)

        self.assertEqual(len(results), len(messages))
        self.assertTrue(all("class_name" in item for item in results))

    def test_empty_or_too_short_message_needs_review(self):
        predictor = ChatPredictor(confidence_threshold=0.55)

        result = predictor.predict_one(" ")

        self.assertEqual(result["class_name"], "needs_review")
        self.assertTrue(result["needs_review"])
        self.assertEqual(result["review_reason"], "too_short")

    def test_probabilities_include_all_model_classes(self):
        result = self.predictor.predict_one("Подготовьте отчет к пятнице")

        self.assertEqual(set(result["probabilities"].keys()), set(CANONICAL_CLASSES))


if __name__ == "__main__":
    unittest.main()
