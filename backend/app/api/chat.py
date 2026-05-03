from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import logging
from mistralai.async_client import MistralAsyncClient
from mistralai.models.chat_completion import ChatMessage

logger = logging.getLogger(__name__)

load_dotenv()

router = APIRouter()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

class ChatRequest(BaseModel):
    query: str
    context: dict  # Contains current market state: regime, signals, confidence

class ChatResponse(BaseModel):
    response: str
    reasoning_steps: list[str]

@router.post("/chat", response_model=ChatResponse)
async def chat_with_quant_ai(request: ChatRequest):
    if not MISTRAL_API_KEY:
        raise HTTPException(status_code=500, detail="Mistral API key not configured")
        
    client = MistralAsyncClient(api_key=MISTRAL_API_KEY)
    
    # Extract Context
    context_str = (
        f"Market Regime: {request.context.get('regime', 'Unknown')}\n"
        f"Confidence Score: {request.context.get('confidence', 0.0)}\n"
        f"Signals:\n"
        f"  - OBI (Order Book Imbalance): {request.context.get('signals', {}).get('obi', 0.0)}\n"
        f"  - VPIN (Volume-Synchronized Probability of Informed Trading): {request.context.get('signals', {}).get('vpin', 0.0)}\n"
        f"  - VWAP Deviation: {request.context.get('signals', {}).get('vwap', 0.0)}\n"
    )

    system_prompt = f"""You are QuantEdge AI, a Level 3 sophisticated quantitative microstructure analyst.
You must analyze the user's query against the following live market context:
{context_str}

Your analysis must be mathematically rigorous, acknowledging latency, toxic flow (VPIN), and regime shifts (LRDE).
You will engage in a 14-step internal reasoning process (7 model-to-model reflection pairs) before providing the final output."""

    messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=f"Please provide an institutional-grade quantitative analysis on this query: {request.query}")
    ]

    reasoning_steps = []
    
    # 7-step inner reflection loop (7 user-model pairs = 14 steps total)
    current_query = request.query
    for i in range(7):
        try:
            # Model generates a thought/reflection
            response = await client.chat(
                model="mistral-large-latest",
                messages=messages
            )
            step_output = response.choices[0].message.content
            reasoning_steps.append(f"Step {i*2 + 1} (Analysis): {step_output}")
            messages.append(ChatMessage(role="assistant", content=step_output))
            
            # Simulated "internal critique/user" prompt to push reasoning further
            if i < 6:
                critique_prompt = f"Critique Step {i+1}. What are the edge cases? Is there microstructure bias? Refine the mathematical precision for the next step."
                reasoning_steps.append(f"Step {i*2 + 2} (Critique): {critique_prompt}")
                messages.append(ChatMessage(role="user", content=critique_prompt))
            else:
                final_prompt = "Synthesize all 7 reasoning steps into a final, highly polished, institutional-grade conclusion."
                reasoning_steps.append(f"Step 14 (Synthesis Request): {final_prompt}")
                messages.append(ChatMessage(role="user", content=final_prompt))
                
        except Exception as e:
            logger.error(f"Mistral API Error during reasoning step {i}: {e}")
            raise HTTPException(status_code=500, detail="Error communicating with Mistral API")
            
    # Final Synthesis Generation
    try:
        final_response = await client.chat(
            model="mistral-large-latest",
            messages=messages
        )
        final_output = final_response.choices[0].message.content
    except Exception as e:
        logger.error(f"Mistral API Error during final synthesis: {e}")
        raise HTTPException(status_code=500, detail="Error communicating with Mistral API")

    return ChatResponse(
        response=final_output,
        reasoning_steps=reasoning_steps
    )

