from .base import BaseSignal
from ..core.events import OrderBookEvent, TickEvent
from collections import deque
import numpy as np

class VWAPDeviationSignal(BaseSignal):
    def __init__(self, window_size: int = 100, z_threshold: float = 2.0):
        super().__init__("VWAP_DEV")
        self.window_size = window_size
        self.z_threshold = z_threshold
        self.ticks = deque(maxlen=window_size)
        self.current_signal = 0.0

    def update_tick(self, event: TickEvent) -> float:
        self.ticks.append(event)
        
        if len(self.ticks) < 10:
            return 0.0
            
        prices = np.array([t.price for t in self.ticks])
        vols = np.array([t.volume for t in self.ticks])
        
        vwap = np.sum(prices * vols) / np.sum(vols)
        std_dev = np.std(prices)
        
        if std_dev == 0:
            return self.current_signal
            
        # Deviation of the latest price from VWAP
        deviation = (event.price - vwap) / std_dev
        
        # Mean reverting signal: if price is above VWAP, sell (-1)
        self.current_signal = -np.clip(deviation / self.z_threshold, -1.0, 1.0)
        return self.current_signal

    def update_book(self, event: OrderBookEvent) -> float:
        return self.current_signal
