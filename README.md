# QuantEdge — Adaptive Microstructure Intelligence Platform

![QuantEdge Overview](https://img.shields.io/badge/Status-Production%20Ready-success)
![Architecture](https://img.shields.io/badge/Architecture-Split%20Stack-blue)
![AI Engine](https://img.shields.io/badge/AI%20Engine-Mistral%20Large-purple)
![WebSockets](https://img.shields.io/badge/Streaming-Realtime%20WebSockets-green)

A production-grade, open-source quantitative research system for cryptocurrency market microstructure. Designed with an emphasis on institutional-grade rigor, hyper-realistic event-driven backtesting, and advanced AI-driven explainability.

## 🚀 Key Features

### 🧠 Intelligence Core
- **Liquidity Regime Detection Engine (LRDE)**: An unsupervised, online K-Means clustering algorithm that classifies market states dynamically into `TRENDING`, `MEAN-REVERTING`, and `TOXIC`.
- **Microstructure Confidence Score (MCS)**: Computes the Shannon entropy of regime probabilities across a rolling window. It mathematically suppresses trading signals during unstable or unpredictable regime transitions.

### 📊 Quantitative Signals
1. **VWAP Deviation**: Volume-weighted average price mean-reversion signal detecting localized over-extensions.
2. **Order Book Imbalance (OBI)**: Normalized bid/ask volume ratio measuring short-term directional flow pressure.
3. **Flow Toxicity (VPIN)**: Volume-Synchronized Probability of Informed Trading, calculated iteratively via high-frequency tick data.
4. **Mid-Price Momentum (MPM)**: Exponentially weighted, normalized returns capturing real-time price acceleration.

### 🤖 Mistral 14-Step Analyst Pipeline
A dedicated AI reasoning engine exposed through a conversational interface:
- Conducts a rigorous **7-iteration (14-step)** internal chain-of-thought analysis.
- Consumes real-time signals (VPIN, VWAP, OBI) and regime data to deliver human-readable, institutional-level market breakdown.
- Entirely transparent: the AI's internal reasoning loop can be inspected by the user in the UI.

### 🎛️ 5D Topographical Dashboard
Built with React, Three.js, and Recharts:
- **Spatial L2 Depth**: A live 3D terrain mapping of the limit order book.
- **Dynamic Lighting**: The scene ambient lighting reacts to the market regime (e.g., pulsating red during toxic flow).
- **Time-Series Charts**: Real-time signal history plotted with trailing window adjustments.

---

## 🏗️ Architecture & Deployment

QuantEdge is structured as a split-stack architecture, optimizing serverless frontend delivery alongside long-running WebSocket connections on the backend.

### Frontend (React + Vite) → Vercel
The frontend is a fast, responsive Single Page Application (SPA).
1. Connect your GitHub repository to Vercel.
2. In the Vercel deployment settings, ensure the framework is set to `Vite`.
3. Add the following Environment Variables in Vercel:
   - `VITE_API_URL` (e.g., `https://your-backend-url.onrender.com`)
   - `VITE_API_WS_URL` (e.g., `wss://your-backend-url.onrender.com/ws`)

### Backend (FastAPI + Python) → Render
The backend requires a persistent environment for WebSocket streaming and high-frequency data ingestion.
1. Connect your GitHub repository to Render and create a new **Web Service**.
2. The provided `render.yaml` automatically sets up the build and start commands.
3. Add the following Environment Variables in the Render Dashboard:
   - `MISTRAL_API_KEY`: Your Mistral AI API key for the 14-step reasoning engine.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- `uv` (Fast Python package installer)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/soumoditt-source/QUANT-EDGE-SYSTEM.git
   cd QUANT-EDGE-SYSTEM
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv pip install -r requirements.txt
   ```
   Create a `.env` file in the `backend` directory:
   ```env
   MISTRAL_API_KEY=your_mistral_api_key_here
   ```
   Run the backend:
   ```bash
   uvicorn app.api.main:app --host 0.0.0.0 --port 8000
   ```

3. **Frontend Setup:**
   Open a new terminal.
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

- **Frontend Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`

---

## 📜 Disclaimer
This project is for research and educational purposes only and does not constitute financial advice. The models provided are examples of quantitative finance theory and should not be deployed with real capital without extensive paper trading and risk management.
