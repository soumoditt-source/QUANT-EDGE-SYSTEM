"""
VWAP Deviation Signal — now routes through C++ bridge.
If C++ module is compiled: native speed.
If not: transparent Python fallback.
"""
from ..core.cpp_bridge import VWAPEngine
from ..core.events import TickEvent, OrderBookEvent


class VWAPDeviationSignal:
    """Thin adapter over VWAPEngine (C++ or Python) that matches the original interface."""

    def __init__(self, window_size: int = 100, z_threshold: float = 2.0):
        self._engine = VWAPEngine(window_size=window_size, z_threshold=z_threshold)

    def update_tick(self, event: TickEvent) -> float:
        return self._engine.update_tick(price=event.price, volume=event.volume)

    def update_book(self, event: OrderBookEvent) -> float:
        return self._engine.current_value

    @property
    def current_signal(self) -> float:
        return self._engine.current_value
