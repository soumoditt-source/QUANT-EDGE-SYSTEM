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
        
        # Use a copy of the clients set to avoid "Set changed size during iteration"
        active_clients = list(clients)
        for client in active_clients:
            try:
                # We create a task to send the message without blocking the broadcast loop.
                # However, we should be careful about not overwhelming the event loop.
                asyncio.create_task(client.send_text(json.dumps(message)))
            except Exception as e:
                logger.error(f"Failed to send message to client: {e}")
                clients.discard(client)
            
    elif hasattr(event, 'price'):
        # It's a TickEvent
        vpin_signal.update_tick(event)
        vwap_signal.update_tick(event)
        obi_signal.update_tick(event)

feed.subscribe(broadcast_data)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Binance Feed...")
    asyncio.create_task(feed.run())

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down Binance Feed...")
    feed.stop()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    logger.info(f"New client connected. Total clients: {len(clients)}")
    try:
        while True:
            # We must keep the connection open by receiving (heartbeats/messages)
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"Client disconnected: {e}")
    finally:
        clients.discard(websocket)
        logger.info(f"Client removed. Remaining clients: {len(clients)}")
