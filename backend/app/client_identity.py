"""Resolve a rate-limit client without trusting proxy headers by default."""

from __future__ import annotations

import ipaddress
import os


def resolve_feedback_client(
    peer_host: str | None,
    forwarded_for: str | None,
) -> str:
    peer = _parse_address(peer_host)
    if peer is None:
        return "unknown"

    trusted_networks = _trusted_proxy_networks()
    if not any(peer in network for network in trusted_networks):
        return str(peer)
    if not forwarded_for:
        return str(peer)

    forwarded = [_parse_address(item.strip()) for item in forwarded_for.split(",")]
    if not forwarded or any(item is None for item in forwarded):
        return str(peer)

    chain = [*forwarded, peer]
    for address in reversed(chain):
        if not any(address in network for network in trusted_networks):
            return str(address)
    return str(forwarded[0])


def _trusted_proxy_networks() -> tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...]:
    raw_value = os.getenv("VITANUSA_TRUSTED_PROXY_IPS", "")
    networks = []
    for value in raw_value.split(","):
        value = value.strip()
        if not value:
            continue
        try:
            networks.append(ipaddress.ip_network(value, strict=False))
        except ValueError:
            continue
    return tuple(networks)


def _parse_address(value: str | None) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    if not value:
        return None
    try:
        return ipaddress.ip_address(value)
    except ValueError:
        return None
