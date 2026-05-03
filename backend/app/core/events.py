from dataclasses import dataclass
from typing import Optional, Dict

@dataclass
class Event:
    timestamp: int # nanoseconds since epoch

@dataclass
class TickEvent(Event):
    symbol: str
    price: float
    volume: float
    is_buyer_maker: bool

@dataclass
class OrderBookEvent(Event):
    symbol: str
    bids: list[tuple[float, float]] # [(price, volume), ...]
    asks: list[tuple[float, float]]

@dataclass
class SignalEvent(Event):
    signal_name: str
    value: float # usually normalized [-1, 1]
    metadata: Optional[Dict] = None

@dataclass
class OrderEvent(Event):
    symbol: str
    side: str # "BUY" or "SELL"
    order_type: str # "LIMIT" or "MARKET"
    price: float
    qty: float

@dataclass
class FillEvent(Event):
    symbol: str
    side: str
    price: float
    qty: float
    fee: float
    slippage: float
    latency_ms: float
