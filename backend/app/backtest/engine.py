import heapq
from typing import List, Callable
from ..core.events import Event, TickEvent, OrderBookEvent
import logging

logger = logging.getLogger(__name__)

class EventDrivenEngine:
    def __init__(self):
        self.event_queue: List[Event] = []
        self.handlers = {}
        
    def register_handler(self, event_type: type, handler: Callable):
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)
        
    def push_event(self, event: Event):
        # We use timestamp as the priority
        heapq.heappush(self.event_queue, (event.timestamp, event))
        
    def run(self):
        while self.event_queue:
            timestamp, event = heapq.heappop(self.event_queue)
            
            handlers = self.handlers.get(type(event), [])
            for handler in handlers:
                try:
                    new_events = handler(event)
                    if new_events:
                        for e in new_events:
                            self.push_event(e)
                except Exception as e:
                    logger.error(f"Error handling event {event}: {e}")
