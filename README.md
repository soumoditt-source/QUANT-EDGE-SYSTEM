# QuantEdge Adaptive Microstructure Intelligence Platform

![QuantEdge](https://img.shields.io/badge/Status-Production%20Ready-success)
![Architecture](https://img.shields.io/badge/Architecture-C%2B%2B%20%7C%20Python%20%7C%20React%20%7C%20Three.js-blue)

QuantEdge is an institutional-grade, hybrid C++/Python quantitative research platform. It leverages native-speed C++ for zero-latency order book mathematics, Python asynchronous orchestration for streaming ingestion, and a deterministic 14-step Chain-of-Thought (CoT) AI layer powered by Mistral to contextualize microstructure signals.

The platform is visualized via a professional full-viewport, zero-scroll interface utilizing GPU-accelerated WebGL (`Three.js`) for cinematic 3D depth topography.

## Core Architecture

### 1. The C++ Microstructure Mathematics Engine
QuantEdge implements proprietary algorithms at the C++ level (`quant_engine.cpp`) to guarantee execution under 250 microseconds.

*   **Order Book Imbalance (OBI):** Predicts micro-directional price pressure.
*   **Volume-Synchronized Probability of Informed Trading (VPIN):** Measures volume toxicity.
*   **VWAP Deviation (Z-Score):** Statistical mean-reversion boundary detection.
*   **Liquidity Regime Detection Engine (LRDE):** Online K-Means Clustering on the [OBI, VPIN, VWAP] vector (Mean-Reverting, Trending, Toxic Flow).
*   **Microstructure Confidence Score (MCS):** Shannon Entropy normalization defining the certainty of the current Liquidity Regime.

### 2. Hybrid Fallback Safety
The system automatically attempts to load the compiled C++ binary (`quant_engine.pyd` or `.so`). If compilation tools are unavailable, it features a transparent fallback mechanism to a mathematically identical pure-Python implementation, ensuring 100% operational uptime across diverse local and cloud environments.

### 3. Deterministic AI Co-Pilot
Integrated with Mistral AI utilizing a rigorous 14-step Chain-of-Thought (CoT) prompt architecture. The AI is forced to mathematically reason through the current OBI, VPIN, VWAP, and MCS data *before* presenting an actionable insight, ensuring transparency and auditability.

### 4. Cinematic 3D Interface
*   **Zero-Scroll Layout:** Strictly locked to `100vw x 100vh` for an application-like feel.
*   **GPU Accelerated:** Uses `THREE.InstancedMesh` with `vertexColors` for dynamic Bid (Green) and Ask (Red) rendering.
*   **Regime-Reactive Lighting & Particles:** The 3D scene lighting and floating particle fields dynamically adapt to the current liquidity regime (e.g., pulsing red during Toxic Flow).

---

## Deployment Configuration

### Frontend (Vercel)
Configured for SPA routing via `vercel.json` with immutable asset caching and strict security headers.
*   **Framework:** React 19 + TypeScript + Vite + TailwindCSS.

### Backend (Render)
Configured via `render.yaml` to automatically compile the C++ extensions (`setup.py build_ext --inplace`) during the cloud build phase.
*   **Framework:** FastAPI + Python 3.11.
*   **Requirements:** `MISTRAL_API_KEY` environment variable.

---

## Local Development Setup

1. **Clone the repository.**
2. **Setup Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   
   # Optional: Compile C++ Engine for maximum performance (Requires MSVC/GCC)
   python setup.py build_ext --inplace
   
   # Start Server
   uvicorn app.api.main:app --reload --port 8000
   ```
   *Note: Ensure you have your `MISTRAL_API_KEY` set in a `.env` file in the backend directory.*

3. **Setup Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Disclaimer
This software is intended for research and educational purposes. It does not constitute financial advice.
