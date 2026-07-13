from __future__ import annotations

from .models import LlmResponse


SAFE_MOCK_CONTENT = (
    "Ini adalah respons simulasi Local LLM untuk menguji router VitaNusa. "
    "Respons ini bukan hasil model nyata dan tidak boleh digunakan sebagai diagnosis "
    "atau rujukan kesehatan."
)

SUPPORTED_MOCK_SCENARIOS = frozenset(
    {
        "success",
        "empty",
        "partial_failure",
        "all_failed",
        "timeout",
        "provider_unavailable",
    }
)


def build_mock_response(
    *,
    provider: str,
    model: str | None,
    scenario: str,
) -> LlmResponse:
    if scenario == "success" or (
        scenario == "partial_failure" and provider != "ollama"
    ):
        return LlmResponse(
            provider=provider,
            model=model,
            content=SAFE_MOCK_CONTENT,
            status="mock",
            is_mock=True,
        )

    if scenario == "empty":
        return LlmResponse(
            provider=provider,
            model=model,
            status="empty",
            is_mock=True,
            error_code="mock_empty_response",
            error_message="Provider simulasi mengembalikan respons kosong.",
        )

    if scenario == "timeout":
        return LlmResponse(
            provider=provider,
            model=model,
            status="timeout",
            is_mock=True,
            error_code="mock_timeout",
            error_message="Batas waktu provider simulasi tercapai.",
        )

    if scenario == "provider_unavailable":
        return LlmResponse(
            provider=provider,
            model=model,
            status="unavailable",
            is_mock=True,
            error_code="mock_provider_unavailable",
            error_message="Provider simulasi tidak tersedia.",
        )

    if scenario in {"partial_failure", "all_failed"}:
        return LlmResponse(
            provider=provider,
            model=model,
            status="failed",
            is_mock=True,
            error_code="mock_provider_failure",
            error_message="Provider simulasi gagal secara terkontrol.",
        )

    return LlmResponse(
        provider=provider,
        model=model,
        status="failed",
        is_mock=True,
        error_code="unknown_mock_scenario",
        error_message="Skenario mock tidak dikenal.",
    )
