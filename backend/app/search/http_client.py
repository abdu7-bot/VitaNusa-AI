from __future__ import annotations

import ipaddress
import socket
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

import httpx

from .ssrf import UnsafeOutboundUrl, validate_outbound_base_url


DEFAULT_MAX_RESPONSE_BYTES = 1_000_000


class UnsafeRedirect(ValueError):
    """Raised when a provider attempts an unexpected HTTP redirect."""


class ResponseTooLarge(ValueError):
    """Raised when a provider response exceeds the configured byte budget."""


def _is_unsafe_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return True
    return any(
        (
            address.is_private,
            address.is_loopback,
            address.is_link_local,
            address.is_multicast,
            address.is_unspecified,
            address.is_reserved,
        )
    )


def validate_resolved_host(hostname: str, *, port: int | None = None) -> tuple[str, ...]:
    """Resolve a provider hostname and reject unsafe resolved addresses.

    This is a runtime defense-in-depth check. The HTTP client still performs
    its own DNS lookup when connecting, so this is not a substitute for a
    network-layer egress policy or a resolver/transport with true IP pinning.
    """
    normalized = hostname.strip().rstrip(".")
    if not normalized:
        raise UnsafeOutboundUrl("missing hostname")

    try:
        literal = ipaddress.ip_address(normalized)
    except ValueError:
        literal = None

    if literal is not None:
        if _is_unsafe_ip(str(literal)):
            raise UnsafeOutboundUrl("resolved host is not public")
        return (str(literal),)

    try:
        infos = socket.getaddrinfo(
            normalized,
            port or 443,
            type=socket.SOCK_STREAM,
        )
    except OSError as exc:
        raise UnsafeOutboundUrl("provider hostname could not be resolved") from exc

    addresses = tuple(sorted({str(info[4][0]) for info in infos if info[4]}))
    if not addresses:
        raise UnsafeOutboundUrl("provider hostname has no resolved address")
    if any(_is_unsafe_ip(address) for address in addresses):
        raise UnsafeOutboundUrl("provider hostname resolves to a non-public address")
    return addresses


async def stream_provider_response(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    params: dict[str, str | int | bool | None] | None = None,
    headers: dict[str, str] | None = None,
    max_bytes: int = DEFAULT_MAX_RESPONSE_BYTES,
) -> tuple[int, dict[str, str], bytes]:
    """Perform one bounded request with redirect following disabled."""
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeOutboundUrl("provider request URL is invalid")
    if parsed.username or parsed.password or parsed.fragment:
        raise UnsafeOutboundUrl("provider request URL contains unsafe components")

    # Re-check DNS immediately before the outbound request to reduce the DNS
    # rebinding window. Redirects are disabled so a provider cannot silently
    # move the request to a different host.
    validate_resolved_host(parsed.hostname, port=parsed.port)

    async with client.stream(
        method,
        url,
        params=params,
        headers=headers,
        follow_redirects=False,
    ) as response:
        if 300 <= response.status_code < 400:
            raise UnsafeRedirect("provider returned an unexpected redirect")
        content_length = response.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > max_bytes:
                    raise ResponseTooLarge("provider response exceeds byte limit")
            except ValueError:
                pass

        chunks: list[bytes] = []
        total = 0
        async for chunk in response.aiter_bytes():
            total += len(chunk)
            if total > max_bytes:
                raise ResponseTooLarge("provider response exceeds byte limit")
            chunks.append(chunk)
        return response.status_code, dict(response.headers), b"".join(chunks)


async def safe_provider_request(
    *,
    url: str,
    timeout_seconds: float,
    method: str = "GET",
    params: dict[str, str | int | bool | None] | None = None,
    headers: dict[str, str] | None = None,
    max_bytes: int = DEFAULT_MAX_RESPONSE_BYTES,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[int, dict[str, str], bytes]:
    """Validate, resolve, and execute a provider request with hard limits."""
    parsed = urlsplit(url)
    base = f"{parsed.scheme}://{parsed.netloc}/"
    validate_outbound_base_url(base, app_env="production")
    timeout = httpx.Timeout(timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
        return await stream_provider_response(
            client,
            method,
            url,
            params=params,
            headers=headers,
            max_bytes=max_bytes,
        )


async def iter_bytes_limited(response: httpx.Response, max_bytes: int) -> AsyncIterator[bytes]:
    """Yield response chunks while enforcing a strict byte budget."""
    total = 0
    async for chunk in response.aiter_bytes():
        total += len(chunk)
        if total > max_bytes:
            raise ResponseTooLarge("provider response exceeds byte limit")
        yield chunk
