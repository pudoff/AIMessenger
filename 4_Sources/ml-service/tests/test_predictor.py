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

    def test_imperative_request_is_task(self):
        result = self.predictor.predict_one("Людочка, принеси мне чай")

        self.assertEqual(result["class_name"], "task")
        self.assertFalse(result["needs_review"])

    def test_toxic_message_is_offtopic(self):
        result = self.predictor.predict_one("ты дурак")

        self.assertEqual(result["class_name"], "offtopic")
        self.assertFalse(result["needs_review"])

    def test_greeting_is_statement(self):
        for message in ("Добрый день!", "Здравствуйте", "Привет всем!"):
            with self.subTest(message=message):
                result = self.predictor.predict_one(message)

                self.assertEqual(result["class_name"], "statement")
                self.assertFalse(result["needs_review"])

    def test_lorem_ipsum_needs_review(self):
        result = self.predictor.predict_one("Lorem ipsum dolor sit amet")

        self.assertEqual(result["class_name"], "needs_review")
        self.assertTrue(result["needs_review"])
        self.assertEqual(result["review_reason"], "lorem_ipsum")

    def test_gibberish_needs_review(self):
        for message in ("лоивамдо", "яывлмвлмыот"):
            with self.subTest(message=message):
                result = self.predictor.predict_one(message)

                self.assertEqual(result["class_name"], "needs_review")
                self.assertTrue(result["needs_review"])
                self.assertEqual(result["review_reason"], "gibberish")

    def test_pangram_without_question_mark_is_not_question(self):
        result = self.predictor.predict_one("съешь ещё этих мягких французских булок")

        self.assertEqual(result["class_name"], "statement")
        self.assertFalse(result["needs_review"])


if __name__ == "__main__":
    unittest.main()
