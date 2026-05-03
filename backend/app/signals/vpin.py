from .base import BaseSignal
from ..core.events import OrderBookEvent, TickEvent
from collections import deque
import numpy as np

class VPINSignal(BaseSignal):
    def __init__(self, bucket_volume: float = 10.0, num_buckets: int = 50):
        super().__init__("VPIN")
        self.bucket_volume = bucket_volume
        self.num_buckets = num_buckets
        
        self.buy_volume = 0.0
        self.sell_volume = 0.0
        self.current_bucket_vol = 0.0
        
        self.buckets = deque(maxlen=num_buckets)
        self.current_signal = 0.0
        
        self.baseline_vpin = 0.5

    def update_tick(self, event: TickEvent) -> float:
        if event.is_buyer_maker:
            # Maker was buyer -> Taker was seller -> Sell volume
            self.sell_volume += event.volume
        else:
            self.buy_volume += event.volume
            
        self.current_bucket_vol += event.volume
        
        if self.current_bucket_vol >= self.bucket_volume:
            imbalance = abs(self.buy_volume - self.sell_volume)
            self.buckets.append(imbalance)
            
            # Reset bucket
            self.buy_volume = 0.0
            self.sell_volume = 0.0
            self.current_bucket_vol = 0.0
            
            # Calculate VPIN
            if len(self.buckets) == self.num_buckets:
                vpin = np.sum(self.buckets) / (self.num_buckets * self.bucket_volume)
                # Normalize VPIN to a signal (-1 for toxic flow)
                self.current_signal = -np.clip((vpin - self.baseline_vpin) / 0.2, -1.0, 1.0)
                
        return self.current_signal

    def update_book(self, event: OrderBookEvent) -> float:
        return self.current_signal
