from __future__ import annotations

import unittest


class RuntimeDependencyTests(unittest.TestCase):
    def test_httpx_is_importable(self) -> None:
        import httpx

        self.assertTrue(hasattr(httpx, "AsyncClient"))

    def test_live_provider_module_is_importable(self) -> None:
        from app.llm import http_providers

        self.assertIsNotNone(http_providers)


if __name__ == "__main__":
    unittest.main()
