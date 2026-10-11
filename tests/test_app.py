import unittest

from rcm_app.app import greet


class TestApp(unittest.TestCase):
    def test_greet_default(self):
        self.assertEqual(greet(), "Hello, World! Welcome to your Python project.")

    def test_greet_custom(self):
        self.assertEqual(greet("Alice"), "Hello, Alice! Welcome to your Python project.")


if __name__ == "__main__":
    unittest.main()
