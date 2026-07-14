"""No-network Web Search Router foundation for VitaNusa AI."""

from .config import WebSearchConfig
from .models import SearchQuery, SearchResult, SearchRouterResponse
from .router import SearchRouter

__all__ = (
    "SearchQuery",
    "SearchResult",
    "SearchRouter",
    "SearchRouterResponse",
    "WebSearchConfig",
)
