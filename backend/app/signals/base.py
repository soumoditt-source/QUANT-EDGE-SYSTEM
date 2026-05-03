from abc import ABC, abstractmethod
from typing import Dict, Any
from ..core.events import OrderBookEvent, TickEvent

class BaseSignal(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def update_tick(self, event: TickEvent) -> float:
        """Returns the updated signal value [-1, 1]"""
        pass

    @abstractmethod
    def update_book(self, event: OrderBookEvent) -> float:
        """Returns the updated signal value [-1, 1]"""
        pass
