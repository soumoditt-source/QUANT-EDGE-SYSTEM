"""
MCS Module — now routes through C++ bridge.
"""
from ..core.cpp_bridge import MCSEngine as _MCSEngine


class MicrostructureConfidenceScore:
    """
    Thin adapter over MCSEngine (C++ or Python) that matches the original interface.
    Computes the Microstructure Confidence Score via Shannon Entropy.
    """

    def __init__(self, window_size: int = 50):
        self._engine = _MCSEngine(window_size=window_size)

    def update(self, regime_probs) -> float:
        """
        regime_probs: array-like of probabilities [P(MR), P(TREND), P(TOXIC)]
        Returns confidence score in [0, 1].
        """
        return self._engine.update(list(regime_probs))

    @property
    def current_score(self) -> float:
        return self._engine.current_value
