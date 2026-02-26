import os
import io
import json
import logging
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.io as pio
import ollama
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from utils.mlx_utils import mlx_model

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
    # Provider selection: "ollama" or "mlx"
    router_provider: Optional[str] = "ollama"
    specialist_provider: Optional[str] = "ollama"
    summarizer_provider: Optional[str] = "ollama"

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
    """Unified generator that dispatches to either Ollama or MLX."""
    # Safety: Auto-detect MLX if model is a path or clearly an MLX identifier
    is_mlx_identifier = os.path.isabs(model) or "mlx" in model.lower()
    
    if provider == "mlx" or is_mlx_identifier:
        logger.info(f"Generating via MLX: {model}")
        temp = options.get('temperature', 0.0) if options else 0.0
        return mlx_model.chat(model, messages, temperature=temp)
    else:
        logger.info(f"Generating via Ollama: {model}")
        response = ollama.chat(model=model, messages=messages, options=options)
        return response['message']['content'].strip()

@app.get("/models/ollama")
async def list_ollama_models():
    try:
        models = ollama.list()
        return {"models": [m['name'] for m in models['models']]}
    except Exception as e:
        logger.error(f"Error listing Ollama models: {e}")
        return {"models": []}

@app.get("/models/mlx")
async def list_mlx_models():
    try:
        models = mlx_model.list_available_models()
        return {"models": models}
    except Exception as e:
        logger.error(f"Error listing MLX models: {e}")
        return {"models": []}

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze_stream")
async def analyze_stream(request: AnalyzeRequest):
    """SSE streaming version of /analyze that sends stage updates."""

    def _sse_event(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def generate():
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
            logger.info(f"Metadata provided to Specialist:\n{request.metadata}")
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
            code = llm_content
            if "```python" in code:
                code = code.split("```python")[1].split("```")[0].strip()
            elif "```" in code:
                code = code.split("```")[1].split("```")[0].strip()
            elif code.startswith("`") and code.endswith("`"):
                code = code.strip("`").strip()
                
            # Auto-fix if LLM forgot to assign 'fig, result ='
            if code.startswith(tool_name) and not "fig, result" in code:
                code = f"fig, result = {code}"

            logger.info(f"Specialist generated code:\n{code}")

            # --- STAGE 3: EXECUTION ---
            yield _sse_event("status", {
                "stage": "executing",
                "message": "Running analysis..."
            })

            from utils.analysis_tools import (
                plot_time_series, plot_distribution, plot_comparison_bars,
                calculate_total, calculate_statistics, get_top_expenses,
            )

            exec_scope = {
                "df": df, "pd": pd, "np": np, "px": px,
                "plot_time_series": plot_time_series,
                "plot_distribution": plot_distribution,
                "plot_comparison_bars": plot_comparison_bars,
                "calculate_total": calculate_total,
                "calculate_statistics": calculate_statistics,
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

            # --- STAGE 4: SUMMARIZE (conditional) ---
            final_result = str(result) if result is not None else None
            should_summarize = fig_obj is None and result is not None and not str(result).startswith("Total") and not str(result).startswith("Average")

            if should_summarize:
                target_model = request.chat_model if request.chat_model else request.model
                yield _sse_event("status", {
                    "stage": "summarizing",
                    "message": "Summarizing results...",
                    "model": target_model,
                    "provider": request.summarizer_provider
                })

                logger.info("Requesting natural language summary from LLM...")
                summary_template = load_prompt_template("summary_prompt.txt")
                # summary_prompt = summary_template.format(result=result, request=request)
                target_model = request.chat_model if request.chat_model else request.model

                logger.info(f"Summarizing with {target_model} via {request.summarizer_provider}...")
                final_result = generate_text(
                    provider=request.summarizer_provider,
                    model=target_model,
                    messages=[
                        {'role': 'system', 'content': summary_template},
                        {'role': 'user', 'content': f"User Question: {request.prompt}\n Analysis Result: {result}"}
                    ],
                    options=request.options
                )
                logger.info(f"Summary generated: {final_result}")
            else:
                logger.info("Skipping LLM summary, using tool result directly.")
                final_result = str(result) if result is not None else "Analysis complete."

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

    return StreamingResponse(generate(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
