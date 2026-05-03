"""
OBI Signal — now routes through C++ bridge.
If C++ module is compiled: native speed.
If not: transparent Python fallback.
"""
from ..core.cpp_bridge import OBIEngine
from ..core.events import OrderBookEvent, TickEvent


class OBISignal:
    """Thin adapter over OBIEngine (C++ or Python) that matches the original interface."""

    def __init__(self, depth: int = 5, ema_span: int = 10):
        self._engine = OBIEngine(depth=depth, ema_span=ema_span)

    def update_tick(self, event: TickEvent) -> float:
        return self._engine.current_value

    def update_book(self, event: OrderBookEvent) -> float:
        bids = [(p, q) for p, q in event.bids]
        asks = [(p, q) for p, q in event.asks]
        return self._engine.update_book(bids, asks)

    @property
    def current_ema(self) -> float:
        return self._engine.current_value
