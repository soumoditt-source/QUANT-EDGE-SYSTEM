from .base import BaseSignal
from ..core.events import OrderBookEvent, TickEvent
from collections import deque
import numpy as np

class MidPriceMomentumSignal(BaseSignal):
    def __init__(self, span: int = 20):
        super().__init__("MPM")
        self.span = span
        self.alpha = 2.0 / (self.span + 1.0)
        self.last_mid = None
        self.current_ema = 0.0
        self.returns = deque(maxlen=100)
        self.current_signal = 0.0

    def update_tick(self, event: TickEvent) -> float:
        return self.current_signal

    def update_book(self, event: OrderBookEvent) -> float:
        if not event.bids or not event.asks:
            return self.current_signal
            
        best_bid = event.bids[0][0]
        best_ask = event.asks[0][0]
        mid_price = (best_bid + best_ask) / 2.0
        
        if self.last_mid is None:
            self.last_mid = mid_price
            return self.current_signal
            
        ret = np.log(mid_price / self.last_mid)
        self.last_mid = mid_price
        
        self.returns.append(ret)
        
        if len(self.returns) == 1:
            self.current_ema = ret
        else:
            self.current_ema = self.alpha * ret + (1 - self.alpha) * self.current_ema
            
        if len(self.returns) < 5:
            return self.current_signal
            
        std_ret = np.std(list(self.returns))
        if std_ret == 0:
            return self.current_signal
            
        self.current_signal = np.clip(self.current_ema / std_ret, -1.0, 1.0)
        return self.current_signal
