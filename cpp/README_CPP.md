# QuantEdge C++ Engine — Build Guide

## What This Is

The `cpp/` directory contains a **C++17 implementation** of all five core quantitative microstructure algorithms used in the QuantEdge backend. These are compiled via `pybind11` into a native Python extension module (`quant_engine.pyd` on Windows, `quant_engine.so` on Linux/Mac).

## Algorithms Implemented

| Engine | Algorithm | Complexity |
|---|---|---|
| `OBIEngine` | Order Book Imbalance (EMA-smoothed) | O(depth) per tick |
| `VPINEngine` | Volume-Synchronized Probability of Informed Trading | O(1) amortized |
| `VWAPEngine` | VWAP Deviation (Z-score normalized) | O(window) per tick |
| `MCSEngine` | Microstructure Confidence Score (Shannon Entropy) | O(window) per update |
| `LRDEEngine` | Liquidity Regime Detection Engine (Online K-Means, 5D) | O(1) per tick |

## Why C++?

In production HFT systems, quantitative signal engines are written in C++ for:
- **Zero-copy memory** — no Python GC overhead during tick processing
- **SIMD instructions** — compiler auto-vectorizes inner loops
- **Predictable latency** — no Python interpreter overhead
- **Consistent with industry practice** — firms like Citadel, Jane Street, and Two Sigma compute signals in C++ and expose to Python via bindings

## How to Build

### Prerequisites
```bash
pip install pybind11
# Windows: Visual Studio 2022 Build Tools (MSVC) required
# Linux:   g++ 11+ or clang++ 14+
```

### Windows (MSVC)
```powershell
cd cpp
python setup.py build_ext --inplace
```
This produces `quant_engine.cpXXX-win_amd64.pyd` in the `cpp/` directory.

### Linux / Mac (Render Cloud)
```bash
cd cpp
python setup.py build_ext --inplace
```
This produces `quant_engine.cpython-311-x86_64-linux-gnu.so`.

## Graceful Fallback

If the C++ module is not compiled, the system **automatically falls back** to the pure-Python implementations in `backend/app/core/cpp_bridge.py`. The system is always runnable — the C++ layer is a performance upgrade, not a hard dependency.

The backend logs `✅ QuantEdge C++ Microstructure Engine loaded.` on successful C++ boot, or `⚠️ Using pure-Python fallback.` if the module isn't found.

## Python Interface (Identical to Python Classes)

```python
from app.core.cpp_bridge import OBIEngine, VPINEngine, VWAPEngine, MCSEngine, LRDEEngine

obi = OBIEngine(depth=5, ema_span=10)
obi_signal = obi.update_book(bids=[(29990.0, 5.2), ...], asks=[(30010.0, 3.1), ...])

vpin = VPINEngine(bucket_volume=10.0, num_buckets=50)
vpin_signal = vpin.update_tick(volume=1.5, is_buyer_maker=True)

vwap = VWAPEngine(window_size=100, z_threshold=2.0)
vwap_signal = vwap.update_tick(price=30000.0, volume=1.5)

mcs = MCSEngine(window_size=50)
confidence = mcs.update([0.7, 0.2, 0.1])

lrde = LRDEEngine(alpha=0.99)
regime, probs = lrde.update([0.8, 1.2, 0.3, 0.6, 0.7])
```
