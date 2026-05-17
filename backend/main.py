import os
import io
import json
import logging
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.io as pio
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

# Import from our new unified inference layer instead of mlx_utils/ollama
from experiments.shared.inference import generate
from experiments.configs.models import get_llamacpp_models

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Expense AI Analytics Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Category Mapping from categories.json
try:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    categories_path = os.path.join(base_dir, "..", "src", "utils", "categories.json")
    with open(categories_path, "r", encoding="utf-8") as f:
        categories_data = json.load(f)
        CATEGORY_MAPPING = categories_data.get("CATEGORY_MAPPING", {})
except Exception as e:
    logger.error(f"Error loading categories.json: {e}")
    CATEGORY_MAPPING = {}

class AnalyzeRequest(BaseModel):
    data: List[dict]
    prompt: Optional[str] = ""
    model: str
    chat_model: Optional[str] = None
    router_model: Optional[str] = None
    metadata: str
    currency: str
    options: Optional[dict] = None
    # Provider selection: "llamacpp"
    router_provider: Optional[str] = "llamacpp"
    specialist_provider: Optional[str] = "llamacpp"
    summarizer_provider: Optional[str] = "llamacpp"

class AnalyzeResponse(BaseModel):
    result: Optional[str] = None
    fig: Optional[str] = None
    code: Optional[str] = None
    error: Optional[str] = None


def load_prompt_template(filename: str) -> str:
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base_dir, "utils", "prompts", filename)
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error loading prompt {filename}: {e}")
        return ""

def generate_text(provider: str, model: str, messages: List[Dict[str, str]], options: Optional[Dict] = None) -> str:
    """Unified generator using our shared inference module."""
    logger.info(f"Generating via {provider}: {model}")
    temp = options.get('temperature', 0.0) if options else 0.0
    
    # We use our unified dispatch
    response_text, elapsed, err = generate(
        backend=provider,
        model_id=model,
        messages=messages,
        temperature=temp,
        enable_thinking=False
    )
    
    if err:
        logger.error(f"Inference error: {err}")
        return ""
    return response_text

@app.get("/models/llamacpp")
async def list_local_models():
    """Return available llama.cpp models dynamically found in experiments/configs/models.py"""
    try:
        models = get_llamacpp_models()
        return {"models": models}
    except Exception as e:
        logger.error(f"Error listing Llama.cpp models: {e}")
        return {"models": []}

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze_stream")
async def analyze_stream(request: AnalyzeRequest):
    """SSE streaming version of /analyze that sends stage updates."""

    def _sse_event(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def generate_fn():
        try:
            # 1. Load data into DataFrame
            logger.info(f"--- New Streaming Analysis Request ---")
            logger.info(f"User Prompt: {request.prompt}")
            logger.info(f"Model: {request.model}")

            df = pd.DataFrame(request.data)
            if 'Date' in df.columns:
                df['Date'] = pd.to_datetime(df['Date']).dt.tz_localize(None)

            # 1b. Enhance DataFrame
            if 'category' in df.columns:
                df['category'] = df['category'].astype(str).str.lower().str.strip()
                df['major category'] = df['category'].map(lambda x: CATEGORY_MAPPING.get(x, 'Miscellaneous'))
                df.loc[df['category'] == 'nan', 'major category'] = ''
                df.loc[df['category'] == '', 'major category'] = ''
            else:
                df['category'] = ''
                df['major category'] = ''

            # 2. Dual-Agent Logic
            from datetime import datetime
            from utils.tool_prompts import get_tool_prompt

            current_date_str = datetime.now().strftime("%Y-%m-%d")
            

            # --- STAGE 1: ROUTER ---
            target_router = request.router_model if request.router_model else request.model
            yield _sse_event("status", {
                "stage": "router",
                "message": f"Routing query...",
                "model": target_router,
                "provider": request.router_provider
            })

            router_template = load_prompt_template("router_prompt.txt")
            logger.info(f"--- Stage 1: Router ({target_router}) via {request.router_provider} ---")
            
            tool_name = generate_text(
                provider=request.router_provider,
                model=target_router,
                messages=[
                    {'role': 'system', 'content': router_template},
                    {'role': 'user', 'content': request.prompt}
                ],
                options=request.options
            )
            tool_name = tool_name.split()[0].replace("`", "").replace("'", "").replace('"', "")
            logger.info(f"Router decided on tool: {tool_name}")

            # --- STAGE 2: SPECIALIST ---
            tool_prompt_template = get_tool_prompt(tool_name)
            if not tool_prompt_template:
                logger.warning(f"Tool '{tool_name}' not found. Falling back to calculate_total.")
                tool_name = "calculate_total"
                tool_prompt_template = get_tool_prompt("calculate_total")

            yield _sse_event("status", {
                "stage": "specialist",
                "message": f"Generating analysis",
                "tool": tool_name,
                "model": request.model,
                "provider": request.specialist_provider
            })

            system_prompt = tool_prompt_template.format(
                metadata=request.metadata,
                current_date=current_date_str,
                function_definition=tool_prompt_template
            )
            logger.info(f"System prompt for Specialist:\n{system_prompt}")

            logger.info(f"--- Stage 2: Specialist ({request.model}) via {request.specialist_provider} for {tool_name} ---")
            # logger.info(f"Metadata provided to Specialist:\n{request.metadata}")
            llm_content = generate_text(
                provider=request.specialist_provider,
                model=request.model,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': request.prompt}
                ],
                options=request.options
            )

            # Extract code
            raw_code = llm_content.strip()
            if "```python" in raw_code:
                raw_code = raw_code.split("```python")[1].split("```")[0].strip()
            elif "```" in raw_code:
                raw_code = raw_code.split("```")[1].split("```")[0].strip()
            elif raw_code.startswith("`") and raw_code.endswith("`"):
                raw_code = raw_code.strip("`").strip()
                
            logger.info(f"Specialist raw output: {raw_code}")

            # Prepend assignment if it's just a raw function call
            code = raw_code
            if not code.startswith("fig, result ="):
                if "(" in code and code.strip().endswith(")"):
                    code = f"fig, result = {code}"
                    logger.info(f"Auto-wrapped code: {code}")

            # logger.info(f"Final Execution Code:\n{code}")

            # --- STAGE 3: EXECUTION ---
            yield _sse_event("status", {
                "stage": "executing",
                "message": "Running analysis..."
            })

            from utils.analysis_tools import (
                plot_time_series, plot_distribution, plot_comparison_bars,
                calculate_total, get_top_expenses,
            )

            exec_scope = {
                "df": df, "pd": pd, "np": np, "px": px,
                "plot_time_series": plot_time_series,
                "plot_distribution": plot_distribution,
                "plot_comparison_bars": plot_comparison_bars,
                "calculate_total": calculate_total,
                "get_top_expenses": get_top_expenses,
                "result": None, "fig": None
            }

            try:
                logger.info("Executing generated code...")
                exec(code, {}, exec_scope)
                logger.info("Execution successful.")
                script_result = exec_scope.get('result')
                logger.info(f"Raw script 'result' value: {script_result}")
            except Exception as e:
                logger.error(f"Execution error: {str(e)}")
                yield _sse_event("error", {"error": f"Execution error: {str(e)}", "code": code})
                return

            result = exec_scope.get('result')
            fig_obj = exec_scope.get('fig')
            fig_json = None

            if fig_obj is not None:
                if hasattr(fig_obj, 'to_json'):
                    fig_json = fig_obj.to_json()
                else:
                    fig_json = str(fig_obj)

            # --- FINAL RESULT ---
            final_result = str(result) if result is not None else "Analysis complete."
            logger.info(f"Final response: {final_result}")
            logger.info("--- Analysis Complete ---")

            # Final result event
            yield _sse_event("result", {
                "result": final_result,
                "fig": fig_json,
                "code": code
            })

        except Exception as e:
            logger.error(f"Streaming analysis failed: {str(e)}")
            yield _sse_event("error", {"error": str(e)})

    return StreamingResponse(generate_fn(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
