import numpy as np
from typing import Dict, List, Tuple
from ..core.events import OrderBookEvent, TickEvent
from ..signals.obi import OBISignal
from ..signals.vpin import VPINSignal
from collections import deque

class LRDEClassifier:
    """
    Liquidity Regime Detection Engine
    Unsupervised Online K-Means with Exponential Decay
    Regimes: 0=MEAN-REVERTING, 1=TRENDING, 2=TOXIC
    """
    def __init__(self, alpha: float = 0.99):
        self.alpha = alpha
        
        # Initial seeded centroids for MR, TREND, TOXIC
        # Feature vector: [OBI, spread_z, VPIN, depth_stability, flow_persistence]
        self.centroids = np.array([
            [0.0, 0.0, 0.0, 1.0, 0.0],  # MR: balanced, tight spread, low vpin, stable depth, no flow
            [0.8, 1.0, 0.2, 0.5, 0.8],  # TREND: high OBI, wider spread, low vpin, mid depth, high flow
            [0.5, 3.0, 0.8, 0.1, 0.5]   # TOXIC: high spread, high vpin, vanishing depth
        ])
        
        self.current_regime = 0
        self.regime_probs = np.array([1.0, 0.0, 0.0])
        
        # Feature calculation helpers
        self.obi_signal = OBISignal(depth=5, ema_span=10)
        self.vpin_signal = VPINSignal()
        
        self.spreads = deque(maxlen=100)
        self.depths = deque(maxlen=30)
        self.flows = deque(maxlen=60)
        
        self.last_tick_direction = 0.0
        
        # Hysteresis buffer
        self.recent_assignments = deque(maxlen=3)

    def _extract_features(self, tick_event: TickEvent = None, book_event: OrderBookEvent = None) -> np.ndarray:
        if tick_event:
            self.vpin_signal.update_tick(tick_event)
            direction = -1.0 if tick_event.is_buyer_maker else 1.0
            self.flows.append(direction)
            
        if book_event:
            self.obi_signal.update_book(book_event)
            
            if book_event.bids and book_event.asks:
                best_bid = book_event.bids[0][0]
                best_ask = book_event.asks[0][0]
                spread = best_ask - best_bid
                self.spreads.append(spread)
                
                total_depth = sum(q for p, q in book_event.bids[:5]) + sum(q for p, q in book_event.asks[:5])
                self.depths.append(total_depth)
        
        # Compute feature vector
        obi_val = self.obi_signal.current_ema
        
        spread_z = 0.0
        if len(self.spreads) > 5:
            spread_mean = np.mean(self.spreads)
            spread_std = np.std(self.spreads)
            if spread_std > 0:
                spread_z = (self.spreads[-1] - spread_mean) / spread_std
                
        vpin_val = abs(self.vpin_signal.current_signal) # Magnitude
        
        depth_stability = 1.0
        if len(self.depths) > 5:
            depth_stability = np.mean(self.depths) / (np.std(self.depths) + 1e-6)
            depth_stability = min(1.0, depth_stability / 10.0) # Normalize loosely
            
        flow_persistence = 0.0
        if len(self.flows) > 5:
            flow_arr = np.array(self.flows)
            flow_persistence = abs(np.sum(flow_arr)) / len(flow_arr)
            
        return np.array([abs(obi_val), spread_z, vpin_val, depth_stability, flow_persistence])

    def update(self, tick_event: TickEvent = None, book_event: OrderBookEvent = None) -> Tuple[int, np.ndarray]:
        x_t = self._extract_features(tick_event, book_event)
        
        # Compute distances
        distances = np.linalg.norm(self.centroids - x_t, axis=1)
        
        # Softmax for probabilities
        exp_d = np.exp(-distances)
        self.regime_probs = exp_d / np.sum(exp_d)
        
        # Raw assignment
        raw_assignment = np.argmax(self.regime_probs)
        self.recent_assignments.append(raw_assignment)
        
        # Hysteresis: Only change if 3 consecutive ticks agree
        if len(self.recent_assignments) == 3 and len(set(self.recent_assignments)) == 1:
            new_regime = self.recent_assignments[0]
            if self.regime_probs[new_regime] > 0.65:
                self.current_regime = new_regime
                
                # Update centroid of the winning class
                self.centroids[self.current_regime] = self.alpha * self.centroids[self.current_regime] + (1 - self.alpha) * x_t

        return self.current_regime, self.regime_probs
