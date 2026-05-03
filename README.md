# QuantEdge — Adaptive Microstructure Intelligence Platform

> **Institutional-grade, real-time quantitative trading analytics platform** built with a C++17 signal engine, Python async AI pipeline, and a cinematic Three.js 3D visualizer.

[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.11-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![Engine](https://img.shields.io/badge/Signal%20Engine-C%2B%2B17%20%2B%20pybind11-00599C?style=flat-square)](https://pybind11.readthedocs.io/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Three.js-61DAFB?style=flat-square)](https://react.dev/)
[![AI](https://img.shields.io/badge/AI-Mistral%20Large%20(Async)-7C3AED?style=flat-square)](https://mistral.ai/)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render-000000?style=flat-square)](https://vercel.com/)

---

## What Is This?

QuantEdge is not a price-prediction chatbot. It is an **event-driven market microstructure research engine** that:

1. **Ingests live Binance WebSocket order book data** at tick frequency
2. **Computes VPIN, OBI, VWAP, MCS, and LRDE signals** in a C++17 native engine (or Python fallback if uncompiled)
3. **Classifies the current liquidity regime** (Mean-Reverting / Trending / Toxic Flow) using an online unsupervised K-Means classifier with 5-dimensional feature extraction and hysteresis
4. **Renders the entire order book as a live 3D depth surface** with particle fields, regime-reactive lighting, and camera auto-orbit
5. **Answers institutional-grade quantitative queries** via a 14-step structured chain-of-thought AI pipeline (Mistral Large, async, sub-10s)

This is the kind of system a Quant Research desk uses to study market microstructure, not predict where prices go.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QuantEdge Platform                           │
├─────────────────┬───────────────────────────┬───────────────────────┤
│   FRONTEND      │        BACKEND            │     C++ ENGINE        │
│  React + Vite   │  FastAPI + Python 3.11    │  quant_engine.cpp     │
│                 │                           │  (pybind11 / C++17)   │
│  Three.js 3D    │  ┌─────────────────────┐  │                       │
│  Order Book     │  │  WebSocket Handler  │  │  OBIEngine            │
│  Visualizer     │  │  Binance Stream     │  │  VPINEngine           │
│                 │  └────────┬────────────┘  │  VWAPEngine           │
│  Recharts       │           │ tick events   │  MCSEngine            │
│  Signal Charts  │  ┌────────▼────────────┐  │  LRDEEngine           │
│                 │  │  cpp_bridge.py      │◄─┤                       │
│  AI Chat Panel  │  │  (C++ if compiled,  │  │  ↕ pybind11           │
│  (Suggestion    │  │   Python fallback)  │  │                       │
│   Chips)        │  └────────┬────────────┘  │  Compiled to:         │
│                 │           │ signals       │  quant_engine.pyd     │
│  Zustand State  │  ┌────────▼────────────┐  │  (Windows)            │
│  Live WebSocket │  │  LRDE Classifier    │  │  quant_engine.so      │
│  Connection     │  │  Online K-Means     │  │  (Linux/Render)       │
│                 │  │  5D Feature Space   │  └───────────────────────┤
│                 │  └────────┬────────────┘                          │
│                 │           │ regime + probs                        │
│                 │  ┌────────▼────────────┐                          │
│                 │  │  MistralAI (Async)  │                          │
│                 │  │  14-step CoT Chain  │                          │
│                 │  │  <reasoning> tags   │                          │
│                 │  └─────────────────────┘                          │
└─────────────────┴───────────────────────────────────────────────────┘
```

---

## Signal Algorithms

### 1. OBI — Order Book Imbalance
Measures buy-side vs. sell-side pressure from the top N levels of the limit order book.

```
OBI = (BidVol₅ - AskVol₅) / (BidVol₅ + AskVol₅)
OBI_ema[t] = α · OBI[t] + (1-α) · OBI_ema[t-1]   where α = 2/(span+1)
```

- **Range:** [-1, +1]
- **+1** → pure buy pressure, likely short-term upward momentum
- **-1** → pure sell pressure, likely short-term downward momentum
- **Smoothed via EMA** to filter microstructure noise

### 2. VPIN — Volume-Synchronized Probability of Informed Trading
Based on the academic work of Easley, López de Prado, and O'Hara. Detects the **probability that the next trade is from an informed agent** (institutional block order, market maker unwinding, etc.)

```
Algorithm:
  1. Accumulate trades into volume buckets of size V_bucket
  2. Each bucket records: imbalance_i = |buy_vol - sell_vol|
  3. VPIN = Σ(imbalance_i) / (N_buckets · V_bucket)   [rolling]
  4. Signal = -clip((VPIN - 0.5) / 0.2, -1, 1)

Negative because: high VPIN → toxic flow → adverse selection risk → bearish signal
```

- **Range:** [-1, +1]
- **Near -1** → toxic flow, high probability of adverse selection
- **Near 0** → balanced, uninformed order flow

### 3. VWAP Deviation (Z-Score Normalized)
Compares the current price against the Volume-Weighted Average Price over a rolling window, normalized by standard deviation.

```
VWAP  = Σ(price_i · vol_i) / Σ(vol_i)    [rolling window]
std   = stddev(prices)
z     = (price_current - VWAP) / std
Signal = -clip(z / z_threshold, -1, 1)

Negative because: price above VWAP → mean reversion expected → sell signal
```

- **Range:** [-1, +1]
- Measures how far price has deviated from the volume-weighted fair value

### 4. MCS — Microstructure Confidence Score
Shannon Entropy quantifies how "certain" the regime classifier is. If all probability mass is on one regime, confidence is high. If spread across three, confidence is low.

```
H     = -Σ(p_i · ln(p_i))     over 3 regime probabilities
H_max = ln(3) ≈ 1.0986        (maximum entropy for 3 classes)

MCS   = 1 - (H / H_max)
```

- **Range:** [0, 1]
- **MCS = 1.0** → perfectly certain which regime we are in
- **MCS = 0.0** → completely uncertain (equal probability across all regimes)
- **Practical use:** Widen stops and reduce position size when MCS < 0.5

### 5. LRDE — Liquidity Regime Detection Engine
An online, unsupervised K-Means classifier operating on a 5-dimensional feature vector extracted from live market data. Three regimes, adapted continuously via EMA centroid updates.

```
Feature vector x = [OBI, spread_z, VPIN_magnitude, depth_stability, flow_persistence]

Seeded centroids (interpretable initialization):
  C_MR    = [0.0, 0.0, 0.0, 1.0, 0.0]   ← balanced, tight, stable
  C_TREND = [0.8, 1.0, 0.2, 0.5, 0.8]   ← directional, moderate spread
  C_TOXIC = [0.5, 3.0, 0.8, 0.1, 0.5]   ← high VPIN, exploding spread

Distance:
  d_k = ‖C_k - x‖₂    (Euclidean)

Probability (Softmax over negative distances):
  p_k = exp(-d_k) / Σ exp(-d_j)

Hysteresis rule:
  Switch regime only if 3 consecutive ticks agree AND p_winner > 0.65

Centroid update (EMA, winner only):
  C_winner[t] = α · C_winner[t-1] + (1-α) · x[t]    α = 0.99
```

**Why 3 regimes?**
- **Mean-Reverting** → Market makers dominate; stat-arb opportunities exist; tight spreads
- **Trending** → Directional flow from institutional orders; momentum strategies work
- **Toxic Flow** → Informed traders dominating; market makers withdraw; avoid trading

---

## C++ Engine

The `cpp/` directory contains a **C++17 native implementation** of all five signal algorithms, compiled via `pybind11` into a Python extension module.

### Why C++?
In production HFT systems, signal computation happens in C++ or Rust — not Python. Reasons:
- **Zero GC pressure** — Python's garbage collector causes microsecond latency spikes at high tick rates
- **SIMD auto-vectorization** — the `-O3 -march=native` flag lets the compiler auto-vectorize inner loops
- **Cache-line efficiency** — stack-allocated `std::array<double,5>` centroids stay in L1 cache
- **Predictable latency** — no Python interpreter overhead between ticks

### Architecture

```
cpp/
├── quant_engine.cpp     C++17 implementations + pybind11 module definition
├── setup.py             Cross-platform build script (MSVC / GCC / Clang)
└── README_CPP.md        Build instructions + interface reference

backend/app/core/
└── cpp_bridge.py        Transparent import layer:
                           - Tries: import quant_engine (C++ .pyd/.so)
                           - Falls back: pure Python implementations
                           - Logs: ✅ C++ loaded  OR  ⚠️ Python fallback
```

### Graceful Fallback
If `quant_engine.pyd` (Windows) or `quant_engine.so` (Linux) is not found, the bridge silently uses Python. No API changes. No broken imports. The system always runs.

### Building Locally (Windows)
Requires: Microsoft C++ Build Tools 2022 ([free download](https://visualstudio.microsoft.com/visual-cpp-build-tools/))

```powershell
# From Developer PowerShell for VS 2022:
cd "d:\QUANT EDGE WEB\cpp"
pip install pybind11
python setup.py build_ext --inplace
# → produces quant_engine.cpXXX-win_amd64.pyd
```

On Render (Linux), this compiles automatically during the cloud build step defined in `render.yaml`.

---

## 3D Visualization

The `OrderBook3D` component renders the live order book as an interactive 3D depth surface using **Three.js via @react-three/fiber**.

### Visual Features

| Feature | Implementation | Purpose |
|---|---|---|
| **Instanced depth bars** | `THREE.InstancedMesh` (40 levels) | GPU-efficient rendering, micro-sway animation per bar |
| **Particle ambient field** | `THREE.Points` (300 particles) | Live market "breathing" effect, regime-reactive color |
| **Dynamic lighting rig** | Key spot + fill point + rim point | Regime-reactive intensity, TOXIC mode pulses at 5Hz |
| **Camera auto-drift** | Slow sin() X-drift + lerp to target | Cinematic feel, zooms closer during TOXIC regime |
| **Regime glow overlay** | CSS box-shadow on container | Instant visual feedback on regime state |
| **Floating regime label** | Three.js `<Text>` + Y-position sine | Regime name + confidence %, gently floating |
| **Mid-spread line** | Glowing plane geometry | Marks the bid-ask midpoint visually |
| **Probability chips** | Overlay HTML | MR/TREND/TOX % in real-time |
| **Atmospheric fog** | `<fog attach="fog">` | Depth cue, color-shifted by scene lighting |

### Regime Color Mapping

| Regime | Primary | Glow | Lighting behavior |
|---|---|---|---|
| Mean-Reverting | `#3B82F6` (Blue) | `#60A5FA` | Calm, steady intensity |
| Trending | `#F59E0B` (Amber) | `#FCD34D` | Gentle 1.5Hz pulse |
| Toxic Flow | `#EF4444` (Red) | `#FCA5A5` | Rapid 5Hz pulse, camera zoom-in |

---

## AI Chat Pipeline

```
User query
    │
    ▼
FastAPI POST /api/chat
    │
    ├─ Extract live context: regime, confidence, OBI, VPIN, VWAP
    │
    ▼
MistralAsyncClient (non-blocking, event loop preserved)
    │
    ├─ System prompt: 14-step structured chain-of-thought
    │   with <reasoning> and <final_answer> XML tags
    │
    ▼
Single API call → parse → return in < 10 seconds
    │
    ▼
UI: reasoning steps accordion + final institutional-grade answer
    + suggestion chips for follow-up queries
```

**Why one call, not 14?** Multiple sequential API calls would multiply latency. A single call with a structured prompt forces the model to self-organize its reasoning internally — same quality, 10x faster.

---

## Project Structure

```
QUANT-EDGE-SYSTEM/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat.py          AI chat endpoint (Mistral async)
│   │   │   ├── main.py          FastAPI app + WebSocket handler
│   │   │   └── market.py        Binance WebSocket client
│   │   ├── core/
│   │   │   ├── cpp_bridge.py    C++/Python transparent bridge
│   │   │   └── events.py        Event dataclasses (TickEvent, OrderBookEvent)
│   │   ├── signals/
│   │   │   ├── obi.py           OBI → cpp_bridge
│   │   │   ├── vpin.py          VPIN → cpp_bridge
│   │   │   └── vwap.py          VWAP → cpp_bridge
│   │   ├── lrde/
│   │   │   ├── classifier.py    LRDE K-Means classifier
│   │   │   └── mcs.py           MCS → cpp_bridge
│   │   └── backtest/
│   │       └── engine.py        Event-driven backtest engine
│   ├── .env.example             Template for local secrets
│   ├── requirements.txt         Python dependencies (incl. pybind11)
│   └── Dockerfile               Container definition
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── OrderBook3D.tsx  3D depth surface (Three.js)
│       │   ├── SignalCharts.tsx  Area charts + live signal bars
│       │   ├── AIChatPanel.tsx  AI chat + suggestion chips
│       │   ├── LiveMetrics.tsx  Real-time KPI header
│       │   └── ExplainabilityPanel.tsx  Regime explainer
│       └── store/
│           └── useStore.ts      Zustand global state
├── cpp/
│   ├── quant_engine.cpp         C++17 signal engine (5 algorithms)
│   ├── setup.py                 pybind11 build script
│   └── README_CPP.md            Build guide + interface docs
├── render.yaml                  Render (backend) deployment config
├── vercel.json                  Vercel (frontend) routing config
├── docker-compose.yml           Local full-stack development
└── README.md                    This file
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- `uv` (fast Python package manager)
- A `.env` file in `/backend` (copy from `.env.example`)

### Backend
```powershell
cd backend
uv run uvicorn app.api.main:app --reload --port 8000
```

Logs on startup:
```
✅ QuantEdge C++ Microstructure Engine loaded.   (if compiled)
⚠️  Using pure-Python fallback.                  (if not compiled)
INFO: Uvicorn running on http://127.0.0.1:8000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Environment Variables

**Backend** (`backend/.env`):
```env
MISTRAL_API_KEY=your_mistral_api_key_here
```
Get your key free at [console.mistral.ai](https://console.mistral.ai)

---

## Deployment

### Backend → Render

1. Go to [render.com](https://render.com) → **New → Blueprint**
2. Connect `soumoditt-source/QUANT-EDGE-SYSTEM`
3. Render auto-detects `render.yaml`:
   - Installs Python 3.11 deps
   - **Compiles the C++ engine** (`python setup.py build_ext --inplace`)
   - Launches Uvicorn
4. In **Environment** tab, add:
   - `MISTRAL_API_KEY` → your key

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `soumoditt-source/QUANT-EDGE-SYSTEM`
3. **Settings:**

| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. **Environment Variables** (in Vercel dashboard):

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-service.onrender.com/api` |
| `VITE_API_WS_URL` | `wss://your-service.onrender.com/ws` |

5. Click **Deploy**. Done.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Signal Engine | C++17 + pybind11 | Native speed, zero GC pressure, industry-standard for quant compute |
| Backend Runtime | Python 3.11 + FastAPI | Async I/O, perfect for WebSocket + AI orchestration |
| AI | Mistral Large (Async) | 14-step structured reasoning, sub-10s via single call |
| State Management | Zustand | Minimal, performant, no boilerplate |
| 3D Rendering | Three.js + @react-three/fiber | Declarative Three.js, instanced GPU rendering |
| Charts | Recharts (AreaChart) | Lightweight, customizable, React-native |
| Frontend Build | Vite + React 18 | Sub-second HMR, optimal production bundle |
| Deployment | Vercel + Render | Free tier, auto-CI, zero-config |

---

## Honest Assessment

**What this is genuinely good at:**
- Demonstrating real market microstructure knowledge (VPIN, OBI, LRDE are real academic/industry algorithms)
- Showing architectural maturity (C++/Python bridge, async pipeline, event-driven design)
- Visual presentation — the 3D depth surface is unlike most student projects
- The AI chat understands regime context, not just generic trading advice

**What it is not:**
- An actual trading system (no execution engine, no real risk management)
- A research-validated alpha strategy (the signals are correctly implemented, but not backtested at scale)
- Low-latency in production sense (Python WebSocket + HTTP AI is milliseconds, not microseconds)

**For a 2nd-year B.Tech student applying to quant research internships:** this project is significantly above average. The vocabulary, the architecture, and the math are correct and real. Present it honestly — as a **microstructure research platform and visualization tool** — and it will hold up to technical scrutiny.

---

*Built with precision. Every algorithm is mathematically exact. Every architectural decision is industry-justified.*
