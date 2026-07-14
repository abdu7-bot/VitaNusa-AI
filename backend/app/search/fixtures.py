from __future__ import annotations

from urllib.parse import urlsplit

from .models import ProviderSearchResponse, SearchQuery, SearchResult


SUPPORTED_MOCK_SCENARIOS = frozenset(
    {
        "success",
        "empty",
        "partial_failure",
        "all_failed",
        "timeout",
        "rate_limited",
        "duplicate_results",
        "provider_unavailable",
    }
)

SIMULATION_NOTICE = (
    "Hasil simulasi untuk menguji Web Search Router VitaNusa. "
    "Ini bukan sumber kesehatan nyata."
)

_SUCCESS_FIXTURES = {
    "brave": (
        (
            "Panduan edukasi kesehatan simulasi",
            "https://health-authority.example/panduan-edukasi",
            "Panduan otoritas kesehatan simulasi. ",
            "2026-06-20",
        ),
        (
            "Cara membaca klaim produk simulasi",
            "https://government-health.example/literasi-klaim",
            "Materi pemerintah simulasi untuk latihan menilai bukti klaim. ",
            "2026-06-18",
        ),
        (
            "Dasar pencarian sumber simulasi",
            "https://education.example/dasar-pencarian",
            "Materi pendidikan simulasi tentang pemilihan sumber. ",
            None,
        ),
    ),
    "duckduckgo": (
        (
            "Konteks edukasi kesehatan simulasi",
            "https://education.example/konteks-kesehatan",
            "Konteks tambahan simulasi, bukan satu-satunya dasar penilaian kesehatan. ",
            "2026-06-17",
        ),
        (
            "Pertanyaan kritis tentang klaim simulasi",
            "https://research.example/pertanyaan-kritis",
            "Ringkasan riset simulasi untuk menguji tampilan hasil pencarian. ",
            "2026-06-15",
        ),
        (
            "Literasi produk VitaNusa simulasi",
            "https://vitanusa.example/literasi-produk",
            "Konten internal simulasi untuk menguji kategori product claim. ",
            None,
        ),
    ),
    "searxng": (
        (
            "Indeks sumber kesehatan simulasi",
            "https://government-health.example/indeks-sumber",
            "Indeks pemerintah simulasi untuk pengujian agregasi hasil. ",
            "2026-06-19",
        ),
        (
            "Metode evaluasi bukti simulasi",
            "https://research.example/evaluasi-bukti",
            "Materi akademik simulasi tentang evaluasi bukti dan keterbatasannya. ",
            "2026-06-16",
        ),
        (
            "Kelas literasi digital simulasi",
            "https://education.example/literasi-digital",
            "Materi kelas simulasi untuk menguji hasil kategori teknologi. ",
            None,
        ),
    ),
}


def build_mock_provider_response(
    *,
    provider: str,
    query: SearchQuery,
    scenario: str,
) -> ProviderSearchResponse:
    if scenario == "success":
        return _success_response(provider, query)

    if scenario == "empty":
        return ProviderSearchResponse(
            provider=provider,
            status="empty",
            error_code="mock_empty_results",
            error_message="Provider simulasi tidak mempunyai hasil.",
            is_mock=True,
        )

    if scenario == "partial_failure":
        if provider == "brave":
            return _success_response(provider, query)
        if provider == "duckduckgo":
            return ProviderSearchResponse(
                provider=provider,
                status="empty",
                error_code="mock_empty_results",
                error_message="Provider simulasi tidak mempunyai hasil.",
                is_mock=True,
            )
        return _failure_response(provider, "timeout")

    if scenario == "duplicate_results":
        return _duplicate_response(provider, query)

    if scenario == "timeout":
        return _failure_response(provider, "timeout")

    if scenario == "rate_limited":
        return _failure_response(provider, "rate_limited")

    if scenario == "provider_unavailable":
        return _failure_response(provider, "unavailable")

    if scenario == "all_failed":
        return _failure_response(provider, "failed")

    return ProviderSearchResponse(
        provider=provider,
        status="failed",
        error_code="unknown_mock_scenario",
        error_message="Skenario simulasi tidak dikenal.",
        is_mock=True,
    )


def _success_response(
    provider: str,
    query: SearchQuery,
) -> ProviderSearchResponse:
    fixtures = _SUCCESS_FIXTURES.get(provider, ())
    results = [
        _result(
            provider=provider,
            title=title,
            url=url,
            snippet=f"{prefix}{SIMULATION_NOTICE}",
            published_at=published_at,
        )
        for title, url, prefix, published_at in fixtures
    ]
    return ProviderSearchResponse(
        provider=provider,
        status="mock",
        results=results[: query.max_results],
        is_mock=True,
    )


def _duplicate_response(
    provider: str,
    query: SearchQuery,
) -> ProviderSearchResponse:
    tracking_suffix = {
        "brave": "?utm_source=brave",
        "duckduckgo": "",
        "searxng": "?utm_campaign=router-test",
    }.get(provider, "")
    snippet_prefix = {
        "brave": "Ringkasan singkat simulasi. ",
        "duckduckgo": (
            "Ringkasan simulasi yang lebih lengkap untuk menguji pemilihan snippet. "
        ),
        "searxng": "Ringkasan alternatif simulasi. ",
    }.get(provider, "Ringkasan simulasi. ")
    shared = _result(
        provider=provider,
        title="Panduan menilai klaim kesehatan simulasi",
        url=(
            "https://health-authority.example/panduan-klaim"
            f"{tracking_suffix}"
        ),
        snippet=f"{snippet_prefix}{SIMULATION_NOTICE}",
        published_at="2026-06-20",
    )
    unique = _success_response(provider, query).results[:1]
    return ProviderSearchResponse(
        provider=provider,
        status="mock",
        results=([shared] + unique)[: query.max_results],
        is_mock=True,
    )


def _failure_response(
    provider: str,
    status: str,
) -> ProviderSearchResponse:
    details = {
        "timeout": (
            "mock_timeout",
            "Batas waktu provider simulasi tercapai.",
        ),
        "rate_limited": (
            "mock_rate_limited",
            "Provider simulasi sedang membatasi permintaan.",
        ),
        "unavailable": (
            "mock_provider_unavailable",
            "Provider simulasi tidak tersedia.",
        ),
        "failed": (
            "mock_provider_failure",
            "Provider simulasi gagal secara terkontrol.",
        ),
    }
    error_code, error_message = details[status]
    return ProviderSearchResponse(
        provider=provider,
        status=status,
        error_code=error_code,
        error_message=error_message,
        is_mock=True,
    )


def _result(
    *,
    provider: str,
    title: str,
    url: str,
    snippet: str,
    published_at: str | None,
) -> SearchResult:
    domain = urlsplit(url).hostname or ""
    return SearchResult(
        title=title,
        url=url,
        snippet=snippet,
        domain=domain,
        provider=provider,
        published_at=published_at,
        is_mock=True,
    )
