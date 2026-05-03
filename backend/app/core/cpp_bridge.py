"""
QuantEdge C++ Bridge
======================
Transparent import layer: attempts to load the compiled C++ quant_engine
module. If unavailable (e.g., build not yet run), falls back gracefully to
the pure-Python implementations so the system always runs.

Architecture Decision:
    Production (Render):    C++ module compiled at build time → imported here.
    Development (local):    Falls back to Python if C++ not yet compiled.
    Zero breaking changes:  All callers (signals/, lrde/) import from here.

This is a standard pattern used in NumPy, scikit-learn, and SciPy.
"""

import logging

logger = logging.getLogger(__name__)

# ─── Attempt C++ import ──────────────────────────────────────────────────────
try:
    import sys, os
    # Make the /cpp directory importable
    cpp_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "cpp")
    cpp_dir = os.path.abspath(cpp_dir)
    if cpp_dir not in sys.path:
        sys.path.insert(0, cpp_dir)

    import quant_engine as _cpp  # type: ignore
    CPP_AVAILABLE = True
    logger.info("✅ QuantEdge C++ Microstructure Engine loaded. All signals running at native speed.")

except ImportError:
    _cpp = None
    CPP_AVAILABLE = False
    logger.warning(
        "⚠️  C++ quant_engine module not found. "
        "Using pure-Python fallback. "
        "To enable: cd cpp && python setup.py build_ext --inplace"
    )


# ─── OBI ─────────────────────────────────────────────────────────────────────

class OBIEngine:
    """Order Book Imbalance with EMA smoothing."""

    def __init__(self, depth: int = 5, ema_span: int = 10):
        if CPP_AVAILABLE:
            self._engine = _cpp.OBIEngine(depth, ema_span)
            self._cpp = True
        else:
            self._depth = depth
            self._alpha = 2.0 / (ema_span + 1.0)
            self._ema = 0.0
            self._init = False
            self._cpp = False

    def update_book(self, bids: list, asks: list) -> float:
        if self._cpp:
            return self._engine.update_book(bids, asks)
        # Python fallback
        bid_vol = sum(q for _, q in bids[:self._depth])
        ask_vol = sum(q for _, q in asks[:self._depth])
        total = bid_vol + ask_vol
        if total < 1e-12:
            return self._ema
        raw = (bid_vol - ask_vol) / total
        if not self._init:
            self._ema = raw
            self._init = True
        else:
            self._ema = self._alpha * raw + (1 - self._alpha) * self._ema
        return max(-1.0, min(1.0, self._ema))

    @property
    def current_value(self) -> float:
        return self._engine.get_current() if self._cpp else self._ema

    def reset(self):
        if self._cpp:
            self._engine.reset()
        else:
            self._ema = 0.0
            self._init = False


# ─── VPIN ────────────────────────────────────────────────────────────────────

class VPINEngine:
    """Volume-Synchronized Probability of Informed Trading."""

    def __init__(self, bucket_volume: float = 10.0, num_buckets: int = 50):
        if CPP_AVAILABLE:
            self._engine = _cpp.VPINEngine(bucket_volume, num_buckets)
            self._cpp = True
        else:
            from collections import deque
            self._bucket_volume = bucket_volume
            self._num_buckets = num_buckets
            self._buy_vol = 0.0
            self._sell_vol = 0.0
            self._curr_vol = 0.0
            self._buckets: deque = deque(maxlen=num_buckets)
            self._signal = 0.0
            self._cpp = False

    def update_tick(self, volume: float, is_buyer_maker: bool) -> float:
        if self._cpp:
            return self._engine.update_tick(volume, is_buyer_maker)
        if is_buyer_maker:
            self._sell_vol += volume
        else:
            self._buy_vol += volume
        self._curr_vol += volume
        if self._curr_vol >= self._bucket_volume:
            imbalance = abs(self._buy_vol - self._sell_vol)
            self._buckets.append(imbalance)
            self._buy_vol = self._sell_vol = self._curr_vol = 0.0
            if len(self._buckets) == self._num_buckets:
                import numpy as np
                vpin = float(sum(self._buckets)) / (self._num_buckets * self._bucket_volume)
                raw = -max(-1.0, min(1.0, (vpin - 0.5) / 0.2))
                self._signal = raw
        return self._signal

    @property
    def current_value(self) -> float:
        return self._engine.get_current() if self._cpp else self._signal

    def reset(self):
        if self._cpp:
            self._engine.reset()
        else:
            self._buy_vol = self._sell_vol = self._curr_vol = self._signal = 0.0
            self._buckets.clear()


# ─── VWAP ────────────────────────────────────────────────────────────────────

class VWAPEngine:
    """VWAP Deviation (Z-score normalized)."""

    def __init__(self, window_size: int = 100, z_threshold: float = 2.0):
        if CPP_AVAILABLE:
            self._engine = _cpp.VWAPEngine(window_size, z_threshold)
            self._cpp = True
        else:
            from collections import deque
            self._window = window_size
            self._z_th = z_threshold
            self._prices: deque = deque(maxlen=window_size)
            self._volumes: deque = deque(maxlen=window_size)
            self._signal = 0.0
            self._cpp = False

    def update_tick(self, price: float, volume: float) -> float:
        if self._cpp:
            return self._engine.update_tick(price, volume)
        self._prices.append(price)
        self._volumes.append(volume)
        if len(self._prices) < 10:
            return 0.0
        import numpy as np
        p = list(self._prices)
        v = list(self._volumes)
        vwap = sum(pi * vi for pi, vi in zip(p, v)) / (sum(v) + 1e-12)
        std = float(np.std(p)) if len(p) > 1 else 0.0
        if std < 1e-12:
            return self._signal
        dev = (price - vwap) / std
        self._signal = -max(-1.0, min(1.0, dev / self._z_th))
        return self._signal

    @property
    def current_value(self) -> float:
        return self._engine.get_current() if self._cpp else self._signal

    def reset(self):
        if self._cpp:
            self._engine.reset()
        else:
            self._prices.clear()
            self._volumes.clear()
            self._signal = 0.0


# ─── MCS ─────────────────────────────────────────────────────────────────────

class MCSEngine:
    """Microstructure Confidence Score (Shannon Entropy)."""

    def __init__(self, window_size: int = 50):
        if CPP_AVAILABLE:
            self._engine = _cpp.MCSEngine(window_size)
            self._cpp = True
        else:
            from collections import deque
            import numpy as np
            self._window = window_size
            self._history: deque = deque(maxlen=window_size)
            self._score = 1.0
            self._cpp = False

    def update(self, regime_probs: list) -> float:
        if self._cpp:
            return self._engine.update(regime_probs)
        import numpy as np
        p = [max(v, 1e-9) for v in regime_probs]
        s = sum(p)
        p = [v / s for v in p]
        self._history.append(p)
        if len(self._history) < 10:
            return self._score
        avg = [sum(row[i] for row in self._history) / len(self._history) for i in range(len(p))]
        entropy = -sum(v * float(np.log(v)) for v in avg if v > 1e-12)
        max_ent = float(np.log(len(avg)))
        self._score = 1.0 - (entropy / max_ent if max_ent > 1e-12 else 0.0)
        return self._score

    @property
    def current_value(self) -> float:
        return self._engine.get_current() if self._cpp else self._score

    def reset(self):
        if self._cpp:
            self._engine.reset()
        else:
            self._history.clear()
            self._score = 1.0


# ─── LRDE ────────────────────────────────────────────────────────────────────

class LRDEEngine:
    """Liquidity Regime Detection Engine (Online K-Means, 5D feature space)."""

    def __init__(self, alpha: float = 0.99):
        if CPP_AVAILABLE:
            self._engine = _cpp.LRDEEngine(alpha)
            self._cpp = True
        else:
            import numpy as np
            self._alpha = alpha
            self._centroids = np.array([
                [0.0, 0.0, 0.0, 1.0, 0.0],
                [0.8, 1.0, 0.2, 0.5, 0.8],
                [0.5, 3.0, 0.8, 0.1, 0.5],
            ])
            self._regime = 0
            self._probs = [1.0, 0.0, 0.0]
            from collections import deque
            self._recent: deque = deque(maxlen=3)
            self._cpp = False

    def update(self, features: list) -> tuple:
        if self._cpp:
            return self._engine.update(features)
        import numpy as np
        x = np.array(features)
        dists = np.linalg.norm(self._centroids - x, axis=1)
        exp_d = np.exp(-dists)
        probs = exp_d / np.sum(exp_d)
        self._probs = probs.tolist()
        raw = int(np.argmax(probs))
        self._recent.append(raw)
        if len(self._recent) == 3 and len(set(self._recent)) == 1:
            if probs[raw] > 0.65:
                self._regime = raw
                self._centroids[raw] = self._alpha * self._centroids[raw] + (1 - self._alpha) * x
        return self._regime, self._probs

    @property
    def current_regime(self) -> int:
        return self._engine.get_regime() if self._cpp else self._regime

    @property
    def current_probs(self) -> list:
        return self._engine.get_probs() if self._cpp else self._probs

    def reset(self):
        if self._cpp:
            self._engine.reset()
        else:
            import numpy as np
            self._centroids = np.array([
                [0.0, 0.0, 0.0, 1.0, 0.0],
                [0.8, 1.0, 0.2, 0.5, 0.8],
                [0.5, 3.0, 0.8, 0.1, 0.5],
            ])
            self._regime = 0
            self._probs = [1.0, 0.0, 0.0]
            self._recent.clear()
