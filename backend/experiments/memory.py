"""
memory.py – Model memory management for Apple Silicon (M1 Pro, 8 GB).

Frees model memory between runs to prevent OOM on memory-constrained hardware.
Fully standalone — no imports from backend/utils/.
"""
from __future__ import annotations

import gc
import logging

logger = logging.getLogger(__name__)


def free_model_memory() -> None:
    """
    Best-effort memory reclamation between models.
    Evicts cached model from llamacpp_model singleton, then gc.
    """
    # Clear the inference singleton
    try:
        from experiments.inference import _llamacpp_model
        if _llamacpp_model is not None:
            _llamacpp_model.model = None
            _llamacpp_model.current_model_path = None
    except Exception:
        try:
            from inference import _llamacpp_model
            if _llamacpp_model is not None:
                _llamacpp_model.model = None
                _llamacpp_model.current_model_path = None
        except Exception:
            pass

    gc.collect()

    logger.info("Model memory freed.")
