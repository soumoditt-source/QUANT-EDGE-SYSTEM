from .base import BaseSignal
from ..core.events import OrderBookEvent, TickEvent
import numpy as np

class OBISignal(BaseSignal):
    def __init__(self, depth: int = 5, ema_span: int = 10):
        super().__init__("OBI")
        self.depth = depth
        self.ema_span = ema_span
        self.alpha = 2.0 / (self.ema_span + 1.0)
        self.current_ema = 0.0
        self.initialized = False

    def update_tick(self, event: TickEvent) -> float:
        return self.current_ema

    def update_book(self, event: OrderBookEvent) -> float:
        bid_vol = sum(q for p, q in event.bids[:self.depth])
        ask_vol = sum(q for p, q in event.asks[:self.depth])
        
        total_vol = bid_vol + ask_vol
        if total_vol == 0:
            return self.current_ema
            
        obi = (bid_vol - ask_vol) / total_vol
        
        if not self.initialized:
            self.current_ema = obi
            self.initialized = True
        else:
            self.current_ema = self.alpha * obi + (1 - self.alpha) * self.current_ema
            
        return max(-1.0, min(1.0, self.current_ema))
