"""
VPIN Signal — now routes through C++ bridge.
If C++ module is compiled: native speed.
If not: transparent Python fallback.
"""
from ..core.cpp_bridge import VPINEngine
from ..core.events import TickEvent, OrderBookEvent


class VPINSignal:
    """Thin adapter over VPINEngine (C++ or Python) that matches the original interface."""

    def __init__(self, bucket_volume: float = 10.0, num_buckets: int = 50):
        self._engine = VPINEngine(bucket_volume=bucket_volume, num_buckets=num_buckets)

    def update_tick(self, event: TickEvent) -> float:
        return self._engine.update_tick(
            volume=event.volume,
            is_buyer_maker=event.is_buyer_maker
        )

    def update_book(self, event: OrderBookEvent) -> float:
        return self._engine.current_value

    @property
    def current_signal(self) -> float:
        return self._engine.current_value
