from dataclasses import dataclass


@dataclass(frozen=True)
class EvidenceReference:
    key: str
    topic: str
    source_key: str
    title: str
    url: str
    supports: str


@dataclass(frozen=True)
class TrustedSource:
    key: str
    name: str
    authority: str
    url: str
    scope: str


TRUSTED_SOURCES = (
    TrustedSource("who", "World Health Organization (WHO)", "Organisasi kesehatan internasional", "https://www.who.int/", "informasi kesehatan masyarakat dan panduan kesehatan global"),
    TrustedSource("kemkes", "Kementerian Kesehatan Republik Indonesia", "Institusi kesehatan pemerintah Indonesia", "https://www.kemkes.go.id/", "informasi kesehatan dan kebijakan kesehatan di Indonesia"),
    TrustedSource("cdc", "Centers for Disease Control and Prevention (CDC)", "Badan kesehatan masyarakat Amerika Serikat", "https://www.cdc.gov/", "edukasi kesehatan masyarakat dan pencegahan penyakit"),
)

SOURCE_MAP = {source.key: source for source in TRUSTED_SOURCES}

# Evidence is deliberately topic-specific. It describes what a source supports,
# not what a particular user has been diagnosed with.
EVIDENCE_REFERENCES = (
    EvidenceReference("who-respiratory", "batuk", "who", "Respiratory illness / COVID-19 public health guidance", "https://www.who.int/health-topics/coronavirus", "gejala pernapasan umum, tanda bahaya seperti kesulitan bernapas, dan langkah mencari pertolongan"),
    EvidenceReference("kemkes-fever", "demam", "kemkes", "Tanda bahaya demam", "https://ayosehat.kemkes.go.id/tag/tanda-bahaya-demam", "edukasi tanda bahaya demam; konteks usia perlu diperhatikan"),
    EvidenceReference("kemkes-dengue", "demam", "kemkes", "Cara Mencegah DBD", "https://ayosehat.kemkes.go.id/cara-mencegah-dbd", "gejala dengue dan tanda peringatan yang memerlukan kewaspadaan"),
    EvidenceReference("who-influenza", "batuk", "who", "Influenza (seasonal)", "https://www.who.int/health-topics/influenza-seasonal", "gejala influenza dan kelompok yang berisiko mengalami penyakit berat"),
    EvidenceReference("who-diarrhoea", "diare", "who", "Diarrhoea", "https://www.who.int/health-topics/diarrhoea", "definisi umum diare, risiko kehilangan cairan, dan pentingnya pencegahan dehidrasi"),
    EvidenceReference("who-pneumonia", "batuk", "who", "Pneumonia", "https://www.who.int/health-topics/pneumonia", "batuk, sesak, demam, nyeri dada, dan tanda berat yang memerlukan perhatian medis"),
)


def list_trusted_sources() -> list[dict[str, str]]:
    return [{"key": s.key, "name": s.name, "authority": s.authority, "url": s.url, "scope": s.scope} for s in TRUSTED_SOURCES]


def evidence_for_navigator(topic: str | None) -> list[dict[str, str]]:
    if not topic:
        return []
    return [
        {"key": e.key, "sourceKey": e.source_key, "title": e.title, "url": e.url, "supports": e.supports}
        for e in EVIDENCE_REFERENCES
        if e.topic == topic
    ]


def sources_for_navigator(topic: str | None) -> list[dict[str, str]]:
    evidence = evidence_for_navigator(topic)
    source_keys = []
    for item in evidence:
        if item["sourceKey"] not in source_keys:
            source_keys.append(item["sourceKey"])
    if not source_keys:
        source_keys = ["kemkes", "who", "cdc"]
    return [{"key": SOURCE_MAP[key].key, "name": SOURCE_MAP[key].name, "url": SOURCE_MAP[key].url} for key in source_keys]
