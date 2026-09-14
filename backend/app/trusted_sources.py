from dataclasses import dataclass


@dataclass(frozen=True)
class TrustedSource:
    key: str
    name: str
    authority: str
    url: str
    scope: str


TRUSTED_SOURCES = (
    TrustedSource(
        key="who",
        name="World Health Organization (WHO)",
        authority="Organisasi kesehatan internasional",
        url="https://www.who.int/",
        scope="informasi kesehatan masyarakat dan panduan kesehatan global",
    ),
    TrustedSource(
        key="kemkes",
        name="Kementerian Kesehatan Republik Indonesia",
        authority="Institusi kesehatan pemerintah Indonesia",
        url="https://www.kemkes.go.id/",
        scope="informasi kesehatan dan kebijakan kesehatan di Indonesia",
    ),
    TrustedSource(
        key="cdc",
        name="Centers for Disease Control and Prevention (CDC)",
        authority="Badan kesehatan masyarakat Amerika Serikat",
        url="https://www.cdc.gov/",
        scope="edukasi kesehatan masyarakat dan pencegahan penyakit",
    ),
)

SOURCE_MAP = {source.key: source for source in TRUSTED_SOURCES}


def list_trusted_sources() -> list[dict[str, str]]:
    return [
        {
            "key": source.key,
            "name": source.name,
            "authority": source.authority,
            "url": source.url,
            "scope": source.scope,
        }
        for source in TRUSTED_SOURCES
    ]


def sources_for_navigator(topic: str | None) -> list[dict[str, str]]:
    """Return a small source set; this registry is not evidence of diagnosis."""
    keys = ("kemkes", "who", "cdc")
    if topic in {"demam", "batuk", "diare"}:
        keys = ("who", "kemkes", "cdc")
    return [
        {
            "key": SOURCE_MAP[key].key,
            "name": SOURCE_MAP[key].name,
            "url": SOURCE_MAP[key].url,
        }
        for key in keys
    ]
