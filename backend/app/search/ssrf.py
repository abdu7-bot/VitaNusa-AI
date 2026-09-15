from __future__ import annotations

import ipaddress
from urllib.parse import urlsplit


class UnsafeOutboundUrl(ValueError):
    """Raised when a configured outbound search URL is unsafe."""


def validate_outbound_base_url(
    value: str,
    *,
    app_env: str = "development",
) -> str:
    """Validate a provider base URL before a live adapter uses it.

    This is a configuration boundary, not a substitute for runtime DNS/IP
    pinning in a live HTTP client. Production requires HTTPS.
    """
    raw = value.strip()
    if not raw:
        raise UnsafeOutboundUrl("missing_outbound_base_url")

    parsed = urlsplit(raw)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeOutboundUrl("invalid_outbound_scheme")
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeOutboundUrl("outbound_url_credentials_not_allowed")
    if not parsed.hostname:
        raise UnsafeOutboundUrl("missing_outbound_hostname")
    if parsed.query or parsed.fragment:
        raise UnsafeOutboundUrl("outbound_url_query_or_fragment_not_allowed")
    if parsed.path and parsed.path != "/":
        raise UnsafeOutboundUrl("outbound_base_path_not_allowed")
    if parsed.scheme == "http" and app_env == "production":
        raise UnsafeOutboundUrl("production_requires_https")

    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsafeOutboundUrl("invalid_outbound_port") from exc
    if port is not None and not 1 <= port <= 65535:
        raise UnsafeOutboundUrl("invalid_outbound_port")

    host = parsed.hostname.rstrip(".").lower()
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return raw.rstrip("/")

    if (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_unspecified
        or address.is_reserved
    ):
        raise UnsafeOutboundUrl("outbound_private_or_local_ip_not_allowed")

    return raw.rstrip("/")
