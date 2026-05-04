import asyncio
import json
import websockets
import logging
from typing import Callable
from time import time_ns
from ..core.events import TickEvent, OrderBookEvent

logger = logging.getLogger(__name__)

class BinanceFeed:
    def __init__(self, symbol: str = "btcusdt"):
        self.symbol = symbol.lower()
        self.uri = f"wss://stream.binance.us:9443/ws"
        self.streams = [
            f"{self.symbol}@aggTrade",
            f"{self.symbol}@depth20@100ms"
        ]
        self.callbacks = []
        self._running = False

    def subscribe(self, callback: Callable):
        self.callbacks.append(callback)

    async def _handle_message(self, message: str):
        data = json.loads(message)
        
        # Determine event type
        if "e" in data and data["e"] == "aggTrade":
            # Tick event
            event = TickEvent(
                timestamp=time_ns(),
                symbol=self.symbol.upper(),
                price=float(data["p"]),
                volume=float(data["q"]),
                is_buyer_maker=data["m"]
            )
            self._dispatch(event)
        
        elif "lastUpdateId" in data:
            # Depth update
            bids = [(float(p), float(q)) for p, q in data["bids"]]
            asks = [(float(p), float(q)) for p, q in data["asks"]]
            event = OrderBookEvent(
                timestamp=time_ns(),
                symbol=self.symbol.upper(),
                bids=bids,
                asks=asks
            )
            self._dispatch(event)

    def _dispatch(self, event):
        for cb in self.callbacks:
            try:
                cb(event)
            except Exception as e:
                logger.error(f"Error in feed callback: {e}")

    async def run(self):
        self._running = True
        stream_names = "/".join(self.streams)
        full_uri = f"{self.uri}/{stream_names}"
        
        while self._running:
            try:
                logger.info(f"Connecting to Binance WS: {full_uri}")
                async with websockets.connect(full_uri) as ws:
                    while self._running:
                        message = await ws.recv()
                        await self._handle_message(message)
            except websockets.exceptions.ConnectionClosed:
                logger.warning("Binance WS Connection Closed. Reconnecting in 2 seconds...")
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Binance WS Error: {e}. Reconnecting...")
                await asyncio.sleep(2)

    def stop(self):
        self._running = False
