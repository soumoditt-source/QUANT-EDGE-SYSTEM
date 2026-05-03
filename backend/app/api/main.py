from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from ..data.binance_feed import BinanceFeed
from ..lrde.classifier import LRDEClassifier
from ..lrde.mcs import MicrostructureConfidenceScore
from ..signals.vpin import VPINSignal
from ..signals.vwap import VWAPDeviationSignal
from ..signals.obi import OBISignal
from .chat import router as chat_router
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="QuantEdge Live Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")

# Global State
feed = BinanceFeed()
lrde = LRDEClassifier()
mcs = MicrostructureConfidenceScore()
clients = set()

# Initialize Signals
vpin_signal = VPINSignal()
vwap_signal = VWAPDeviationSignal()
obi_signal = OBISignal()

def broadcast_data(event):
    # This is simplified. In a real system, you'd serialize properly.
    if hasattr(event, 'bids'):
        # It's an OrderBookEvent
        regime, probs = lrde.update(book_event=event)
        confidence = mcs.update(probs)
        
        obi_val = obi_signal.update_book(event)
        vpin_val = vpin_signal.update_book(event)
        vwap_val = vwap_signal.update_book(event)
        
        message = {
            "type": "book_update",
            "bids": event.bids[:10],
            "asks": event.asks[:10],
            "regime": int(regime),
            "probs": probs.tolist(),
            "confidence": float(confidence),
            "timestamp": event.timestamp,
            "signals": {
                "obi": obi_val,
                "vpin": vpin_val,
                "vwap": vwap_val
            }
        }
        
        for client in clients:
            asyncio.create_task(client.send_text(json.dumps(message)))
            
    elif hasattr(event, 'price'):
        # It's a TickEvent
        vpin_signal.update_tick(event)
        vwap_signal.update_tick(event)
        obi_signal.update_tick(event)

feed.subscribe(broadcast_data)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(feed.run())

@app.on_event("shutdown")
def shutdown_event():
    feed.stop()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        clients.remove(websocket)
