import numpy as np
from collections import deque

class MicrostructureConfidenceScore:
    """
    Computes the Microstructure Confidence Score (MCS) based on the 
    entropy of the regime probability distribution.
    """
    def __init__(self, window_size: int = 50):
        self.window_size = window_size
        self.prob_history = deque(maxlen=window_size)
        self.current_score = 1.0

    def update(self, regime_probs: np.ndarray) -> float:
        """
        regime_probs: array of probabilities [P(MR), P(TREND), P(TOXIC)]
        """
        # Ensure valid probability distribution
        regime_probs = np.clip(regime_probs, 1e-9, 1.0)
        regime_probs = regime_probs / np.sum(regime_probs)
        
        self.prob_history.append(regime_probs)
        
        if len(self.prob_history) < 10:
            return self.current_score
            
        # Average probability distribution over the window
        avg_probs = np.mean(self.prob_history, axis=0)
        
        # Calculate normalized Shannon Entropy
        # Max entropy for 3 classes is ln(3) ~ 1.0986
        entropy = -np.sum(avg_probs * np.log(avg_probs))
        max_entropy = np.log(len(avg_probs))
        
        normalized_entropy = entropy / max_entropy
        
        # Confidence score is inverse of entropy
        self.current_score = 1.0 - normalized_entropy
        
        return self.current_score
