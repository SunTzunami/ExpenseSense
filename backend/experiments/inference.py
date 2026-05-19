"""
inference.py – Unified inference dispatch for LlamaCpp, Ollama, and Google API backends.

All backends return the same (response, elapsed_s, error_or_None) triple.
Fully standalone — no imports from backend/utils/.
"""
from __future__ import annotations

import time
import os
import logging
import jinja2
from typing import Optional

# Monkey-patch Jinja2 Environment to always include loopcontrols 
# This fixes "Encountered unknown tag 'continue'" in Llama.cpp chat templates (e.g. EXAONE-4.0)
_original_jinja_init = jinja2.Environment.__init__
def _patched_jinja_init(self, **kwargs):
    extensions = kwargs.get("extensions", [])
    if "jinja2.ext.loopcontrols" not in extensions:
        extensions = list(extensions) + ["jinja2.ext.loopcontrols"]
    kwargs["extensions"] = extensions
    _original_jinja_init(self, **kwargs)
jinja2.Environment.__init__ = _patched_jinja_init

logger = logging.getLogger(__name__)

# ── Singleton for LlamaCpp model (lazy-loaded) ────────────────────────────────────
_llamacpp_model = None
_last_usage: dict = {}  # token-level usage from most recent inference


def get_last_usage() -> dict:
    """Return token usage dict from the most recent LLM call.
    Keys: prompt_tokens, completion_tokens, total_tokens."""
    return dict(_last_usage)


class LlamaCppModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LlamaCppModel, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.current_model_path = None
            cls._instance.last_usage = {}
        return cls._instance

    def resolve_path(self, model_identifier: str) -> str:
        """Resolves a model identifier to an absolute path.
        Looks in local directory and LM Studio caches."""
        if os.path.exists(model_identifier):
            return model_identifier
            
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_root = os.path.dirname(script_dir)
        models_dir = os.path.join(backend_root, "models")
        
        # Check in experiments/models directly
        potential_path = os.path.join(models_dir, model_identifier)
        if os.path.exists(potential_path):
            return potential_path
            
        # Check LM studio caches, just in case
        lm_studio_base = os.path.expanduser("~/.lmstudio/models")
        if os.path.exists(lm_studio_base):
            for publisher in os.listdir(lm_studio_base):
                if publisher.startswith('.'): continue
                pub_path = os.path.join(lm_studio_base, publisher)
                if not os.path.isdir(pub_path): continue
                for model_folder in os.listdir(pub_path):
                    if model_folder.startswith('.'): continue
                    potential_file = os.path.join(pub_path, model_folder, model_identifier)
                    if os.path.exists(potential_file):
                        return potential_file
                        
        return os.path.join(models_dir, model_identifier)  # fallback

    def load_model(self, model_identifier: str) -> None:
        from llama_cpp import Llama
        import gc
            
        model_path = self.resolve_path(model_identifier)
        
        if self.current_model_path == model_path and self.model is not None:
            return

        logger.info(f"Loading Llama.cpp model from: {model_path} (Identified as: {model_identifier})")
        try:
            self.model = Llama(
                model_path=model_path,
                n_gpu_layers=-1, # Accelerate as much as possible
                n_ctx=4096, # Context window size
                verbose=False
            )
            self.current_model_path = model_path
            logger.info("Llama.cpp model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Llama.cpp model: {e}")
            raise e

    def chat(self, model_identifier: str, messages: list, max_tokens: int = 4096, temperature: float = 0.0) -> str:
        self.load_model(model_identifier)
        try:
            response = self.model.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            self.last_usage = response.get("usage", {})
            return response["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Llama.cpp chat error: {e}")
            raise e


def _get_llamacpp_model():
    """Lazy-load the LlamaCpp model wrapper."""
    global _llamacpp_model
    if _llamacpp_model is None:
        _llamacpp_model = LlamaCppModel()
    return _llamacpp_model


# ── Llama.cpp inference ────────────────────────────────────────────────────────────

def generate_llamacpp(
    model_id: str,
    messages: list[dict[str, str]],
    temperature: float = 0.0,
    enable_thinking: bool = False,
) -> tuple[str, float, Optional[str]]:
    """Call the LlamaCpp model via local llamacpp_utils singleton and return (response, elapsed_s, error)."""
    try:
        llamacpp_model = _get_llamacpp_model()

        t0 = time.perf_counter()
        response = llamacpp_model.chat(
            model_id,
            messages=messages,
            temperature=temperature
        )
        elapsed = time.perf_counter() - t0

        global _last_usage
        _last_usage = llamacpp_model.last_usage

        return response.strip(), elapsed, None
    except Exception as exc:
        logger.error(f"LlamaCpp inference error: {exc}")
        return "", 0.0, str(exc)


# ── Ollama inference ─────────────────────────────────────────────────────────

def generate_ollama(
    model_id: str,
    messages: list[dict[str, str]],
    temperature: float = 0.0,
) -> tuple[str, float, Optional[str]]:
    """Call Ollama and return (response, elapsed_s, error)."""
    try:
        import ollama

        t0 = time.perf_counter()
        response = ollama.chat(
            model=model_id,
            messages=messages,
            options={"temperature": temperature},
        )
        elapsed = time.perf_counter() - t0

        global _last_usage
        _last_usage = {
            "prompt_tokens": response.get("prompt_eval_count", 0),
            "completion_tokens": response.get("eval_count", 0),
            "total_tokens": response.get("prompt_eval_count", 0) + response.get("eval_count", 0),
        }

        return response["message"]["content"].strip(), elapsed, None
    except ImportError:
        return "", 0.0, "ollama package not installed. Run: pip install ollama"
    except Exception as exc:
        logger.error(f"Ollama inference error: {exc}")
        return "", 0.0, str(exc)


# ── Google API inference ─────────────────────────────────────────────────────

def generate_google(
    model_id: str,
    messages: list[dict[str, str]],
    temperature: float = 0.0,
) -> tuple[str, float, Optional[str]]:
    """Call Google Generative AI API and return (response, elapsed_s, error)."""
    try:
        import google.generativeai as genai
        import os

        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "", 0.0, "GOOGLE_API_KEY environment variable not set"

        genai.configure(api_key=api_key)

        # Convert messages to Google format
        system_msg = ""
        conversation = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg += msg["content"] + "\n"
            elif msg["role"] == "user":
                conversation.append({"role": "user", "parts": [msg["content"]]})
            elif msg["role"] == "assistant":
                conversation.append({"role": "model", "parts": [msg["content"]]})

        model = genai.GenerativeModel(
            model_id,
            system_instruction=system_msg.strip() if system_msg else None,
        )

        t0 = time.perf_counter()
        response = model.generate_content(
            conversation,
            generation_config=genai.GenerationConfig(temperature=temperature),
        )
        elapsed = time.perf_counter() - t0

        global _last_usage
        usage_metadata = getattr(response, "usage_metadata", None)
        if usage_metadata:
            _last_usage = {
                "prompt_tokens": usage_metadata.prompt_token_count,
                "completion_tokens": usage_metadata.candidates_token_count,
                "total_tokens": usage_metadata.total_token_count,
            }
        else:
            _last_usage = {}

        return response.text.strip(), elapsed, None
    except ImportError:
        return "", 0.0, "google-generativeai package not installed. Run: pip install google-generativeai"
    except Exception as exc:
        logger.error(f"Google API inference error: {exc}")
        return "", 0.0, str(exc)


# ── Unified dispatch ─────────────────────────────────────────────────────────

def generate(
    backend: str,
    model_id: str,
    messages: list[dict[str, str]],
    temperature: float = 0.0,
    enable_thinking: bool = False,
) -> tuple[str, float, Optional[str]]:
    """
    Unified inference dispatch.

    backend: 'llamacpp', 'ollama', 'google'
    Returns: (response_text, elapsed_seconds, error_string_or_None)
    """
    if backend == "llamacpp":
        return generate_llamacpp(model_id, messages, temperature, enable_thinking)
    elif backend == "ollama":
        return generate_ollama(model_id, messages, temperature)
    elif backend == "google":
        return generate_google(model_id, messages, temperature)
    else:
        return "", 0.0, f"Unknown backend: {backend}"
