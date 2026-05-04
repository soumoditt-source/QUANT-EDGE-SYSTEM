from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import logging
from mistralai import Mistral

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
        
    client = Mistral(api_key=MISTRAL_API_KEY)
    
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

CRITICAL INSTRUCTION:
You MUST conduct a rigorous 14-step internal chain-of-thought analysis before providing your final answer.
Format your response EXACTLY like this:

<reasoning>
Step 1: [Analyze Context]
Step 2: [Evaluate Regime]
Step 3: [Analyze VPIN]
Step 4: [Analyze OBI]
Step 5: [Analyze VWAP]
Step 6: [Mathematical Synthesis]
Step 7: [Latency Implications]
Step 8: [Edge Cases Check]
Step 9: [Risk Assessment]
Step 10: [Institutional Comparison]
Step 11: [Flow Toxicity Critique]
Step 12: [Confidence Score Impact]
Step 13: [Final Review]
Step 14: [Synthesis Request]
</reasoning>
<final_answer>
[Your polished, institutional-grade quantitative conclusion here]
</final_answer>"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Please provide an institutional-grade quantitative analysis on this query: {request.query}"}
    ]

    reasoning_steps = []
    final_output = "Analysis could not be completed."
    
    try:
        import time
        start_time = time.time()
        
        response = await client.chat.complete_async(
            model="mistral-large-latest",
            messages=messages
        )
        
        raw_content = response.choices[0].message.content
        
        # Parse the structured output
        import re
        reasoning_match = re.search(r'<reasoning>(.*?)</reasoning>', raw_content, re.DOTALL)
        answer_match = re.search(r'<final_answer>(.*?)</final_answer>', raw_content, re.DOTALL)
        
        if reasoning_match:
            steps_text = reasoning_match.group(1).strip()
            reasoning_steps = [step.strip() for step in steps_text.split('\n') if step.strip()]
        else:
            reasoning_steps = ["Could not parse reasoning steps. Fast-path synthesis used."]
            
        if answer_match:
            final_output = answer_match.group(1).strip()
        else:
            final_output = raw_content.replace("<reasoning>", "").replace("</reasoning>", "")
            
        execution_time = time.time() - start_time
        logger.info(f"Mistral API call completed in {execution_time:.2f} seconds")

    except Exception as e:
        logger.error(f"Mistral API Error: {e}")
        raise HTTPException(status_code=500, detail="Error communicating with Mistral API")

    return ChatResponse(
        response=final_output,
        reasoning_steps=reasoning_steps
    )

