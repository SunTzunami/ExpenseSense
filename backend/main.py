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
from experiments.inference import generate
from experiments.models import get_llamacpp_models
from utils.llm_input_validation import validate_and_fix_params

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
def _deduplicate_category_mapping(mapping: dict) -> dict:
    seen: dict[str, str] = {}
    deduped: dict[str, str] = {}
    for original_key, value in mapping.items():
        lower_key = original_key.lower()
        if lower_key not in seen:
            seen[lower_key] = original_key
            deduped[original_key] = value
    return deduped

try:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    categories_path = os.path.join(base_dir, "..", "src", "utils", "categories.json")
    with open(categories_path, "r", encoding="utf-8") as f:
        categories_data = json.load(f)
        CATEGORY_MAPPING = _deduplicate_category_mapping(categories_data.get("CATEGORY_MAPPING", {}))
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
            
            router_output = generate_text(
                provider=request.router_provider,
                model=target_router,
                messages=[
                    {'role': 'system', 'content': router_template},
                    {'role': 'user', 'content': request.prompt}
                ],
                options=request.options
            )
            # Parse number from router
            from utils.tool_registry import TOOL_ID_TO_NAME
            import re
            
            clean_router = router_output.strip().replace("`", "").replace("'", "").replace('"', "")
            digit_match = re.search(r'[1-5]', clean_router)
            if digit_match:
                tool_id = int(digit_match.group(0))
                tool_name = TOOL_ID_TO_NAME.get(tool_id, "calculate_total")
            else:
                logger.warning(f"Router output did not contain a valid tool ID (1-5): '{router_output}'. Attempting name fallback...")
                fallback_found = False
                for name in TOOL_ID_TO_NAME.values():
                    if name in clean_router:
                        tool_name = name
                        fallback_found = True
                        break
                if not fallback_found:
                    tool_name = "calculate_total"
            logger.info(f"Router decided on tool: {tool_name} (raw output: {router_output.strip()})")

            # --- STAGE 2: SPECIALIST ---
            tool_prompt_template = get_tool_prompt(tool_name, model_id=request.model)
            if not tool_prompt_template:
                logger.warning(f"Tool '{tool_name}' not found. Falling back to calculate_total.")
                tool_name = "calculate_total"
                tool_prompt_template = get_tool_prompt("calculate_total", model_id=request.model)

            yield _sse_event("status", {
                "stage": "specialist",
                "message": f"Generating analysis",
                "tool": tool_name,
                "model": request.model,
                "provider": request.specialist_provider
            })

            system_prompt = tool_prompt_template.replace(
                "{metadata}", request.metadata
            ).replace(
                "{current_date}", current_date_str
            )
            logger.info(f"System prompt for Specialist:\n{system_prompt}")

            logger.info(f"--- Stage 2: Specialist ({request.model}) via {request.specialist_provider} for {tool_name} ---")
            llm_content = generate_text(
                provider=request.specialist_provider,
                model=request.model,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': request.prompt}
                ],
                options=request.options
            )

            # Extract json
            raw_code = llm_content.strip()
            json_str = raw_code
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            elif json_str.startswith("`") and json_str.endswith("`"):
                json_str = json_str.strip("`").strip()
                
            logger.info(f"Specialist raw output: {raw_code}")
            logger.info(f"Extracted JSON string: {json_str}")

            params = {}
            try:
                params = json.loads(json_str)
                if not isinstance(params, dict):
                    logger.warning(f"Parsed JSON is not a dict: {type(params)}")
                    params = {}
            except Exception as json_err:
                logger.error(f"JSON parsing failed: {json_err}. Trying regex fallback...")
                # Regex fallback parsing
                for key in ["category", "year", "month", "day", "start_year", "start_month", "end_year", "end_month", "months", "ignore_rent", "remarks", "n", "min_amount", "y1", "m1", "d1", "y2", "m2", "d2", "sm1", "em1", "sm2", "em2", "ey1", "ey2"]:
                    pattern = r'["\']?' + re.escape(key) + r'["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)["\']?'
                    match = re.search(pattern, json_str)
                    if match:
                        val = match.group(1).strip()
                        if val.lower() == 'true':
                            params[key] = True
                        elif val.lower() == 'false':
                            params[key] = False
                        elif re.fullmatch(r'-?\d+', val):
                            params[key] = int(val)
                        elif val.lower() != 'none' and val.lower() != 'null':
                            params[key] = val
                logger.info(f"Regex fallback parsed params: {params}")

            # --- STAGE 2.5: VALIDATE & FIX PARAMS ---
            params, validation_warning = validate_and_fix_params(params, df)
            if validation_warning:
                logger.info(f"Validation fixes applied: {validation_warning}")

            # --- STAGE 3: EXECUTION ---
            yield _sse_event("status", {
                "stage": "executing",
                "message": "Running analysis..."
            })

            from utils.analysis_tools import (
                plot_time_series, plot_distribution, plot_comparison_bars,
                calculate_total, get_top_expenses,
                clear_warnings, get_warnings
            )

            clear_warnings()

            tool_functions = {
                "plot_time_series": plot_time_series,
                "plot_distribution": plot_distribution,
                "plot_comparison_bars": plot_comparison_bars,
                "calculate_total": calculate_total,
                "get_top_expenses": get_top_expenses,
            }
            
            tool_fn = tool_functions.get(tool_name, calculate_total)
            
            fig_obj = None
            result = None
            try:
                logger.info(f"Directly calling function {tool_fn.__name__} with parameters: {params}")
                fig_obj, result = tool_fn(df, **params)
                logger.info("Execution successful.")
            except Exception as e:
                logger.error(f"Execution error: {str(e)}")
                yield _sse_event("error", {"error": f"Execution error: {str(e)}", "code": raw_code})
                return

            fig_json = None

            if fig_obj is not None:
                if hasattr(fig_obj, 'to_json'):
                    fig_json = fig_obj.to_json()
                else:
                    fig_json = str(fig_obj)

            warnings_list = get_warnings()

            # --- FINAL RESULT ---
            final_result = str(result) if result is not None else "Analysis complete."
            logger.info(f"Final response: {final_result}")
            logger.info("--- Analysis Complete ---")

            # Final result event
            yield _sse_event("result", {
                "result": final_result,
                "fig": fig_json,
                "code": raw_code,
                "router_output": router_output,
                "tool_name": tool_name,
                "validation_fixes": warnings_list
            })

        except Exception as e:
            logger.error(f"Streaming analysis failed: {str(e)}")
            yield _sse_event("error", {"error": str(e)})

    return StreamingResponse(generate_fn(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
