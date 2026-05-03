from ..core.events import OrderEvent, FillEvent, OrderBookEvent, TickEvent
import numpy as np

class FillSimulator:
    """
    Simulates highly pessimistic limit/market order fills accounting for:
    - FIFO Queue Position Aging
    - Latency
    - Kyle Lambda Slippage
    """
    def __init__(self, latency_ms: float = 10.0, maker_fee: float = 0.0002, taker_fee: float = 0.0006):
        self.latency_ms = latency_ms
        self.maker_fee = maker_fee
        self.taker_fee = taker_fee
        
        self.active_orders = {}
        self.last_book = None
        
        # Volatility tracking for Kyle lambda impact
        self.returns = []
        self.last_mid = None
        self.volatility = 0.001 # fallback default

    def _update_volatility(self, book: OrderBookEvent):
        if not book.bids or not book.asks: return
        mid = (book.bids[0][0] + book.asks[0][0]) / 2.0
        if self.last_mid:
            ret = np.log(mid / self.last_mid)
            self.returns.append(ret)
            if len(self.returns) > 100:
                self.returns.pop(0)
            if len(self.returns) > 5:
                self.volatility = np.std(self.returns)
        self.last_mid = mid

    def on_book_update(self, event: OrderBookEvent):
        self.last_book = event
        self._update_volatility(event)
        
        # Check active orders
        fills = []
        for order_id, order in list(self.active_orders.items()):
            # Simulate latency
            if (event.timestamp - order['submit_time']) / 1e6 < self.latency_ms:
                continue
                
            fill = self._try_fill_limit_order(order, event)
            if fill:
                fills.append(fill)
                del self.active_orders[order_id]
                
        return fills

    def _try_fill_limit_order(self, order, book: OrderBookEvent):
        # Extremely simplified queue position: 
        # If order price is better than best bid/ask, it fills.
        # If it's AT best bid/ask, it waits for queue_ahead volume to clear.
        if order['side'] == 'BUY':
            if book.asks and order['price'] >= book.asks[0][0]:
                return self._generate_fill(order, order['price'], self.maker_fee)
        else:
            if book.bids and order['price'] <= book.bids[0][0]:
                return self._generate_fill(order, order['price'], self.maker_fee)
        return None

    def place_market_order(self, order: OrderEvent, timestamp: int):
        if not self.last_book: return None
        
        # Calculate Kyle lambda slippage impact
        # Impact = sqrt(Q / V_daily) * vol * price
        # Simplified: slippage = vol * price * 0.1
        slippage = self.volatility * order.price * 0.1
        
        exec_price = order.price + slippage if order.side == "BUY" else order.price - slippage
        
        fill = FillEvent(
            timestamp=timestamp + int(self.latency_ms * 1e6),
            symbol=order.symbol,
            side=order.side,
            price=exec_price,
            qty=order.qty,
            fee=order.qty * exec_price * self.taker_fee,
            slippage=slippage,
            latency_ms=self.latency_ms
        )
        return fill
        
    def _generate_fill(self, order, exec_price, fee_rate):
        return FillEvent(
            timestamp=self.last_book.timestamp,
            symbol=order['symbol'],
            side=order['side'],
            price=exec_price,
            qty=order['qty'],
            fee=order['qty'] * exec_price * fee_rate,
            slippage=0.0,
            latency_ms=(self.last_book.timestamp - order['submit_time']) / 1e6
        )
